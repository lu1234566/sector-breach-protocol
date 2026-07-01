// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCEnemyAIController.h"
#include "DOCEnemyCharacter.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/Pawn.h"

double ADOCEnemyAIController::LastGlobalEnemyShotTimeSeconds = -1000.0;

ADOCEnemyAIController::ADOCEnemyAIController()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ADOCEnemyAIController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);

	ControlledEnemy = Cast<ADOCEnemyCharacter>(InPawn);
	if (InPawn)
	{
		LastTickLocation = InPawn->GetActorLocation();
	}

	SpawnTimeSeconds = FPlatformTime::Seconds();
	// Web version staggers first-shot eligibility randomly up to 2s after
	// spawn (nextShotAt = spawnTime + Math.random()*2000).
	NextShotAtSeconds = SpawnTimeSeconds + FMath::FRandRange(0.f, 2.f);
}

void ADOCEnemyAIController::SetSpawnContext(int32 InWaveNumber, float InRunStartTimeSeconds)
{
	WaveNumber = InWaveNumber;
	RunStartTimeSeconds = InRunStartTimeSeconds;
}

APawn* ADOCEnemyAIController::GetPlayerPawn() const
{
	if (const UWorld* World = GetWorld())
	{
		return UGameplayStatics::GetPlayerPawn(World, 0);
	}
	return nullptr;
}

void ADOCEnemyAIController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!ControlledEnemy.IsValid() || ControlledEnemy->bIsDead)
	{
		return;
	}

	UpdateAI(DeltaSeconds);
}

bool ADOCEnemyAIController::TraceLineOfSightToPlayer(FVector& OutEnemyEyeLoc, FVector& OutPlayerLoc, float& OutDistance) const
{
	ADOCEnemyCharacter* Enemy = ControlledEnemy.Get();
	APawn* PlayerPawn = GetPlayerPawn();
	if (!Enemy || !PlayerPawn)
	{
		return false;
	}

	OutEnemyEyeLoc = Enemy->GetActorLocation() + FVector(0.f, 0.f, Enemy->BaseEyeHeight);
	OutPlayerLoc = PlayerPawn->GetActorLocation();
	OutDistance = FVector::Dist(OutEnemyEyeLoc, OutPlayerLoc);

	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(Enemy);
	QueryParams.AddIgnoredActor(PlayerPawn);

	FHitResult Hit;
	const bool bBlocked = GetWorld()->LineTraceSingleByChannel(Hit, OutEnemyEyeLoc, OutPlayerLoc, ECC_Visibility, QueryParams);
	return !bBlocked;
}

void ADOCEnemyAIController::UpdateAI(float DeltaSeconds)
{
	ADOCEnemyCharacter* Enemy = ControlledEnemy.Get();
	APawn* PlayerPawn = GetPlayerPawn();
	if (!Enemy || !PlayerPawn)
	{
		return;
	}

	FVector EnemyLoc, PlayerLoc;
	float Distance = 0.f;
	const bool bHasLOS = TraceLineOfSightToPlayer(EnemyLoc, PlayerLoc, Distance);

	if (bHasLOS)
	{
		const float DistanceTolerance = 16.f;
		const FVector ToPlayer = (PlayerLoc - EnemyLoc).GetSafeNormal2D();
		const FVector StrafeDirection(-ToPlayer.Y, ToPlayer.X, 0.f);

		FVector MoveDirection = FVector::ZeroVector;

		if (Distance > Enemy->TargetDistance + DistanceTolerance)
		{
			CurrentState = EDOCEnemyAIState::Approaching;
			MoveDirection += ToPlayer;
		}
		else if (Distance < Enemy->TargetDistance - DistanceTolerance * 2.f)
		{
			CurrentState = EDOCEnemyAIState::Retreating;
			MoveDirection -= ToPlayer;
		}
		else
		{
			CurrentState = EDOCEnemyAIState::Holding;
		}

		// Flank/strafe component applies whenever the player is close,
		// independent of the approach/hold/retreat branch above - matches
		// enemyAI.ts's `if (dist < 150) { moveX += -sin*speed*0.7; ... }`.
		if (Distance < StrafeTriggerDistance)
		{
			MoveDirection += StrafeDirection * 0.7f;
		}

		// Stuck detection ported from enemyAI.ts's frame-count version
		// (stuckFrames>60 escape, >120 reset) as a time-based equivalent
		// assuming ~60fps: >1s stuck triggers the nudge, >2s resets it.
		const float MovedDistance = FVector::Dist(Enemy->GetActorLocation(), LastTickLocation);
		if (!MoveDirection.IsNearlyZero() && MovedDistance < 0.1f)
		{
			StuckTimeSeconds += DeltaSeconds;
		}
		else
		{
			StuckTimeSeconds = FMath::Max(0.f, StuckTimeSeconds - DeltaSeconds * 2.f);
		}

		if (StuckTimeSeconds > 1.f)
		{
			CurrentState = EDOCEnemyAIState::Unstucking;
			MoveDirection = StrafeDirection;
			if (StuckTimeSeconds > 2.f)
			{
				StuckTimeSeconds = 0.f;
			}
		}

		if (!MoveDirection.IsNearlyZero())
		{
			Enemy->AddMovementInput(MoveDirection.GetSafeNormal());
		}

		// NOTE: the web version re-checks line of sight a second time at the
		// exact moment of firing (shotLOS), since it can change within the
		// same tick. This skeleton reuses the movement-phase LOS check for
		// simplicity - acceptable for a first pass, revisit if it reads as
		// too permissive once there's real level geometry to test against.
		TryFireAtPlayer(Distance);
	}
	else
	{
		CurrentState = EDOCEnemyAIState::NavigatingToLineOfSight;
		MoveToLocation(PlayerLoc, /*AcceptanceRadius=*/50.f, /*bStopOnOverlap=*/true, /*bUsePathfinding=*/true);
	}

	LastTickLocation = Enemy->GetActorLocation();
}

void ADOCEnemyAIController::TryFireAtPlayer(float Distance)
{
	ADOCEnemyCharacter* Enemy = ControlledEnemy.Get();
	APawn* PlayerPawn = GetPlayerPawn();
	if (!Enemy || !PlayerPawn)
	{
		return;
	}

	const double Now = FPlatformTime::Seconds();

	// INITIAL_GRACE_PERIOD: nobody fires in the first 5s of the run.
	if (Now - RunStartTimeSeconds < InitialGracePeriodSeconds)
	{
		return;
	}

	// canShoot: minimum time after spawn before the first shot - 3s on
	// wave 1, 1.5s otherwise.
	const float MinTimeBeforeFirstShot = (WaveNumber == 1) ? 3.f : 1.5f;
	if (Now - SpawnTimeSeconds < MinTimeBeforeFirstShot)
	{
		return;
	}

	// globalShootCooldown: wave 1 only, staggers every enemy's shots.
	if (WaveNumber == 1 && (Now - LastGlobalEnemyShotTimeSeconds) < Wave1GlobalShotCooldownSeconds)
	{
		return;
	}

	if (Now < NextShotAtSeconds)
	{
		return;
	}

	const float FireRateMult = (WaveNumber == 1) ? Wave1FireRateMultiplier : 1.f;
	const float FireRateSeconds = (Enemy->FireRateMs / 1000.f) * FireRateMult;
	if (Now - LastShotTimeSeconds < FireRateSeconds)
	{
		return;
	}

	const bool bIsMeleeAttack = Enemy->bIsMelee && !Enemy->bIsBoss;
	const float EffectiveRange = bIsMeleeAttack ? MeleeAttackRange : Enemy->ShootRange;
	if (Distance >= EffectiveRange)
	{
		return;
	}

	LastShotTimeSeconds = Now;
	if (WaveNumber == 1)
	{
		LastGlobalEnemyShotTimeSeconds = Now;
	}

	const float DamageMult = (WaveNumber == 1) ? Wave1DamageMult : 1.f;
	const float Damage = Enemy->DamagePerHit * DamageMult;

	UGameplayStatics::ApplyDamage(PlayerPawn, Damage, this, Enemy, nullptr);

	// Tracer VFX (ranged) / melee swing anim / hit + shot SFX are
	// Editor-phase concerns (Niagara systems, Anim Notifies, Sound Cues) -
	// see EDITOR_TODO.md.
}
