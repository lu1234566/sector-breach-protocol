// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Wave spawner, ported from src/game-app/game/systems/useWaveSystem.ts and
// GameApp.tsx::spawnEnemies. See docs/scorestreaks.md #1.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/DOCTypes.h"
#include "DOCWaveManagerComponent.generated.h"

class ADOCEnemyCharacter;
class UDataTable;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDOCWaveStartedSignature, int32, WaveNumber);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDOCEnemyKilledSignature, ADOCEnemyCharacter*, DeadEnemy);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FDOCAllEnemiesClearedSignature);

UCLASS(ClassGroup = (ProtocolDOC), meta = (BlueprintSpawnableComponent))
class UDOCWaveManagerComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UDOCWaveManagerComponent();

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Wave")
	TSubclassOf<ADOCEnemyCharacter> EnemyCharacterClass;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Wave")
	TObjectPtr<UDataTable> DifficultyDataTable;

	// Enemy spawn markers are collected at BeginPlay via
	// UGameplayStatics::GetAllActorsWithTag(this, EnemySpawnPointTag) -
	// replaces arenas.ts's per-arena spawnPoints array. Placed by hand per
	// level - see EDITOR_TODO.md.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Wave")
	FName EnemySpawnPointTag = TEXT("DOCEnemySpawnPoint");

	// BOSS_WAVE = 5 in constants.ts: every 5th wave spawns a Titan.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Wave")
	int32 BossWaveInterval = 5;

	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Wave")
	FDOCWaveStartedSignature OnWaveStarted;

	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Wave")
	FDOCEnemyKilledSignature OnEnemyKilled;

	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Wave")
	FDOCAllEnemiesClearedSignature OnAllEnemiesCleared;

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Wave")
	void StartWave(int32 WaveNumber, EDOCDifficulty Difficulty, double RunStartTimeSeconds);

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Wave")
	int32 GetAliveEnemyCount() const;

protected:
	virtual void BeginPlay() override;

private:
	UFUNCTION()
	void HandleEnemyDeath(ADOCEnemyCharacter* DeadEnemy);

	void SpawnOneEnemy(bool bIsBossSpawn);
	void OnSpawnTick();
	void OnBossSpawnTimer();
	FVector PickSpawnLocation() const;
	float GetDifficultyHPMult(EDOCDifficulty Difficulty) const;
	float GetDifficultyDamageMult(EDOCDifficulty Difficulty) const;

	TArray<TWeakObjectPtr<AActor>> SpawnPoints;
	TArray<TWeakObjectPtr<ADOCEnemyCharacter>> AliveEnemies;

	int32 CurrentWaveNumber = 1;
	EDOCDifficulty CurrentDifficulty = EDOCDifficulty::Normal;
	double CurrentRunStartTimeSeconds = 0.0;

	int32 SpawnedCountThisWave = 0;
	int32 TargetCountThisWave = 0;
	bool bIsBossWaveActive = false;

	FTimerHandle SpawnIntervalTimer;
	FTimerHandle BossSpawnTimer;
};
