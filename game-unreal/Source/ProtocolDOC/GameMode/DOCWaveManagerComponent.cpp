// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCWaveManagerComponent.h"
#include "AI/DOCEnemyCharacter.h"
#include "AI/DOCEnemyAIController.h"
#include "Data/DOCDifficultyData.h"
#include "Engine/DataTable.h"
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"

namespace DOCDifficultyRows
{
	static FName ToRowName(EDOCDifficulty Difficulty)
	{
		switch (Difficulty)
		{
		case EDOCDifficulty::Recruit: return TEXT("Recruit");
		case EDOCDifficulty::Normal: return TEXT("Normal");
		case EDOCDifficulty::Veteran: return TEXT("Veteran");
		case EDOCDifficulty::Nightmare: return TEXT("Nightmare");
		default: return NAME_None;
		}
	}
}

UDOCWaveManagerComponent::UDOCWaveManagerComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UDOCWaveManagerComponent::BeginPlay()
{
	Super::BeginPlay();

	TArray<AActor*> FoundActors;
	UGameplayStatics::GetAllActorsWithTag(GetWorld(), EnemySpawnPointTag, FoundActors);
	for (AActor* Actor : FoundActors)
	{
		SpawnPoints.Add(Actor);
	}
}

float UDOCWaveManagerComponent::GetDifficultyHPMult(EDOCDifficulty Difficulty) const
{
	if (!DifficultyDataTable)
	{
		return 1.f;
	}
	static const FString Context(TEXT("UDOCWaveManagerComponent::GetDifficultyHPMult"));
	if (const FDOCDifficultyData* Row = DifficultyDataTable->FindRow<FDOCDifficultyData>(DOCDifficultyRows::ToRowName(Difficulty), Context))
	{
		return Row->HPMult;
	}
	return 1.f;
}

float UDOCWaveManagerComponent::GetDifficultyDamageMult(EDOCDifficulty Difficulty) const
{
	if (!DifficultyDataTable)
	{
		return 1.f;
	}
	static const FString Context(TEXT("UDOCWaveManagerComponent::GetDifficultyDamageMult"));
	if (const FDOCDifficultyData* Row = DifficultyDataTable->FindRow<FDOCDifficultyData>(DOCDifficultyRows::ToRowName(Difficulty), Context))
	{
		return Row->DamageMult;
	}
	return 1.f;
}

FVector UDOCWaveManagerComponent::PickSpawnLocation() const
{
	TArray<TWeakObjectPtr<AActor>> ValidPoints = SpawnPoints.FilterByPredicate([](const TWeakObjectPtr<AActor>& Point)
	{
		return Point.IsValid();
	});

	if (ValidPoints.Num() == 0)
	{
		return GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector;
	}

	const int32 Index = FMath::RandRange(0, ValidPoints.Num() - 1);
	return ValidPoints[Index]->GetActorLocation();
}

void UDOCWaveManagerComponent::StartWave(int32 WaveNumber, EDOCDifficulty Difficulty, double RunStartTimeSeconds)
{
	GetWorld()->GetTimerManager().ClearTimer(SpawnIntervalTimer);
	GetWorld()->GetTimerManager().ClearTimer(BossSpawnTimer);

	CurrentWaveNumber = WaveNumber;
	CurrentDifficulty = Difficulty;
	CurrentRunStartTimeSeconds = RunStartTimeSeconds;
	SpawnedCountThisWave = 0;
	bIsBossWaveActive = (WaveNumber % BossWaveInterval == 0);

	// count = wave===1 ? 3 : min(3 + wave*2, 24), matches useWaveSystem.ts.
	TargetCountThisWave = (WaveNumber == 1) ? 3 : FMath::Min(3 + WaveNumber * 2, 24);

	OnWaveStarted.Broadcast(WaveNumber);

	// 800ms between spawns, matches useWaveSystem.ts's setInterval.
	GetWorld()->GetTimerManager().SetTimer(SpawnIntervalTimer, this, &UDOCWaveManagerComponent::OnSpawnTick, 0.8f, true);
}

void UDOCWaveManagerComponent::OnSpawnTick()
{
	if (SpawnedCountThisWave >= TargetCountThisWave)
	{
		GetWorld()->GetTimerManager().ClearTimer(SpawnIntervalTimer);
		if (bIsBossWaveActive)
		{
			// 4s delay before the Titan spawns, matches
			// useWaveSystem.ts::scheduleBoss.
			GetWorld()->GetTimerManager().SetTimer(BossSpawnTimer, this, &UDOCWaveManagerComponent::OnBossSpawnTimer, 4.f, false);
		}
		return;
	}

	SpawnOneEnemy(/*bIsBossSpawn=*/false);
	++SpawnedCountThisWave;
}

void UDOCWaveManagerComponent::OnBossSpawnTimer()
{
	SpawnOneEnemy(/*bIsBossSpawn=*/true);
}

void UDOCWaveManagerComponent::SpawnOneEnemy(bool bIsBossSpawn)
{
	if (!EnemyCharacterClass)
	{
		return;
	}

	EDOCEnemyType Type;
	if (bIsBossSpawn)
	{
		Type = EDOCEnemyType::Titan;
	}
	else if (CurrentWaveNumber == 1)
	{
		// spawnEnemies: wave 1 rolls rifleman 60% / rusher 40%
		// (`Math.random() > 0.4 ? "rifleman" : "rusher"`).
		Type = (FMath::FRand() > 0.4f) ? EDOCEnemyType::Rifleman : EDOCEnemyType::Rusher;
	}
	else
	{
		static const EDOCEnemyType Roll[] = { EDOCEnemyType::Rusher, EDOCEnemyType::Rifleman, EDOCEnemyType::Sniper };
		Type = Roll[FMath::RandRange(0, 2)];
	}

	const FVector SpawnLocation = PickSpawnLocation();

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

	ADOCEnemyCharacter* NewEnemy = GetWorld()->SpawnActor<ADOCEnemyCharacter>(EnemyCharacterClass, SpawnLocation, FRotator::ZeroRotator, SpawnParams);
	if (!NewEnemy)
	{
		return;
	}

	NewEnemy->InitializeFromWave(Type, CurrentWaveNumber, GetDifficultyHPMult(CurrentDifficulty), GetDifficultyDamageMult(CurrentDifficulty));
	NewEnemy->OnDeath.AddDynamic(this, &UDOCWaveManagerComponent::HandleEnemyDeath);

	if (ADOCEnemyAIController* AIController = Cast<ADOCEnemyAIController>(NewEnemy->GetController()))
	{
		AIController->SetSpawnContext(CurrentWaveNumber, CurrentRunStartTimeSeconds);
	}

	AliveEnemies.Add(NewEnemy);
}

int32 UDOCWaveManagerComponent::GetAliveEnemyCount() const
{
	int32 Count = 0;
	for (const TWeakObjectPtr<ADOCEnemyCharacter>& Enemy : AliveEnemies)
	{
		if (Enemy.IsValid() && !Enemy->bIsDead)
		{
			++Count;
		}
	}
	return Count;
}

void UDOCWaveManagerComponent::HandleEnemyDeath(ADOCEnemyCharacter* DeadEnemy)
{
	OnEnemyKilled.Broadcast(DeadEnemy);

	if (SpawnedCountThisWave >= TargetCountThisWave && GetAliveEnemyCount() == 0)
	{
		OnAllEnemiesCleared.Broadcast();
	}
}
