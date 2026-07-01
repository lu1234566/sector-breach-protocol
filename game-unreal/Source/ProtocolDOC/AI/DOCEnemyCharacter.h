// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Enemy pawn. Stats initialized from DT_EnemyTypes
// (Data/CSV/EnemyTypes.csv) plus per-wave/per-difficulty scaling, ported
// from GameApp.tsx::spawnEnemies - see docs/bots-ia.md.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Data/DOCTypes.h"
#include "DOCEnemyCharacter.generated.h"

class UDataTable;
class ADOCEnemyCharacter;
struct FDOCEnemyData;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDOCEnemyDeathSignature, ADOCEnemyCharacter*, DeadEnemy);

UCLASS()
class ADOCEnemyCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ADOCEnemyCharacter();

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Enemy")
	TObjectPtr<UDataTable> EnemyDataTable;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	EDOCEnemyType EnemyType = EDOCEnemyType::Rifleman;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float CurrentHP = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float MaxHP = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float DamagePerHit = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float FireRateMs = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float TargetDistance = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	float ShootRange = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	bool bIsMelee = false;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	bool bIsBoss = false;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Enemy")
	bool bIsDead = false;

	// Listened to by DOCWaveManagerComponent (spawn counters, boss-defeated),
	// UDOCObjectiveComponent (eliminate/defend kill counts) and
	// UDOCEconomySubsystem (score/credits/pickup drop) - kept decoupled from
	// this class rather than duplicating combat.ts's single post-kill block.
	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Enemy")
	FDOCEnemyDeathSignature OnDeath;

	// Called by DOCWaveManagerComponent right after SpawnActor. Applies the
	// per-wave HP/speed scaling (hpBuff/speedBuff) and per-difficulty
	// multipliers exactly like GameApp.tsx::spawnEnemies. Note the Titan row
	// in DT_EnemyTypes already bakes in the web version's boss x20 HP /
	// x2.5 damage / x0.7 speed multipliers - no extra boss scaling here.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Enemy")
	void InitializeFromWave(EDOCEnemyType InType, int32 WaveNumber, float DifficultyHPMult, float DifficultyDamageMult);

	// Score awarded on kill: 5000 boss / 500 sniper / 200 rifleman / 100
	// rusher, matches combat.ts's killScore ternary.
	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Enemy")
	int32 GetKillScoreValue() const;

protected:
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

private:
	const FDOCEnemyData* FindEnemyData(EDOCEnemyType Type) const;
};
