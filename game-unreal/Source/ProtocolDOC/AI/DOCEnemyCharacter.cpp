// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCEnemyCharacter.h"
#include "Data/DOCEnemyData.h"
#include "Engine/DataTable.h"
#include "GameFramework/CharacterMovementComponent.h"

namespace DOCEnemyRows
{
	static FName ToRowName(EDOCEnemyType Type)
	{
		switch (Type)
		{
		case EDOCEnemyType::Rusher: return TEXT("Rusher");
		case EDOCEnemyType::Rifleman: return TEXT("Rifleman");
		case EDOCEnemyType::Sniper: return TEXT("Sniper");
		case EDOCEnemyType::Titan: return TEXT("Titan");
		default: return NAME_None;
		}
	}
}

ADOCEnemyCharacter::ADOCEnemyCharacter()
{
	PrimaryActorTick.bCanEverTick = false;
}

const FDOCEnemyData* ADOCEnemyCharacter::FindEnemyData(EDOCEnemyType Type) const
{
	if (!EnemyDataTable)
	{
		return nullptr;
	}
	static const FString Context(TEXT("ADOCEnemyCharacter::FindEnemyData"));
	return EnemyDataTable->FindRow<FDOCEnemyData>(DOCEnemyRows::ToRowName(Type), Context, /*bWarnIfRowMissing=*/true);
}

void ADOCEnemyCharacter::InitializeFromWave(EDOCEnemyType InType, int32 WaveNumber, float DifficultyHPMult, float DifficultyDamageMult)
{
	const FDOCEnemyData* Data = FindEnemyData(InType);
	if (!Data)
	{
		return;
	}

	EnemyType = InType;
	bIsBoss = Data->bIsBoss;
	bIsMelee = Data->bIsMelee;
	FireRateMs = Data->FireRateMs;
	TargetDistance = Data->TargetDistance;
	ShootRange = Data->ShootRange;

	// Matches enemyAI.ts/GameApp.tsx::spawnEnemies exactly:
	//   hpBuff = 1 + (wave-1)*0.15
	//   speedBuff = min(1 + (wave-1)*0.04, 1.6)
	const float HpBuff = 1.f + (WaveNumber - 1) * 0.15f;
	const float SpeedBuff = FMath::Min(1.f + (WaveNumber - 1) * 0.04f, 1.6f);

	MaxHP = Data->BaseHP * HpBuff * DifficultyHPMult;
	CurrentHP = MaxHP;
	DamagePerHit = Data->BaseDamage * DifficultyDamageMult;
	bIsDead = false;

	if (UCharacterMovementComponent* Movement = GetCharacterMovement())
	{
		Movement->MaxWalkSpeed = Data->BaseSpeed * SpeedBuff;
	}
}

int32 ADOCEnemyCharacter::GetKillScoreValue() const
{
	if (bIsBoss)
	{
		return 5000;
	}
	switch (EnemyType)
	{
	case EDOCEnemyType::Sniper:
		return 500;
	case EDOCEnemyType::Rifleman:
		return 200;
	default:
		return 100;
	}
}

float ADOCEnemyCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	if (bIsDead)
	{
		return 0.f;
	}

	const float AppliedDamage = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	CurrentHP = FMath::Max(0.f, CurrentHP - AppliedDamage);

	if (CurrentHP <= 0.f)
	{
		bIsDead = true;
		SetActorEnableCollision(false);
		if (UCharacterMovementComponent* Movement = GetCharacterMovement())
		{
			Movement->DisableMovement();
		}
		// Scoring, credits, pickup drop chance (scavenger upgrade) and
		// objective kill-count all listen here - see docs/scorestreaks.md
		// #2-3 for the formulas that should live in those listeners.
		OnDeath.Broadcast(this);
	}

	return AppliedDamage;
}
