// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Makes the implicit per-frame decision tree in
// src/game-app/game/systems/enemyAI.ts explicit as a real state machine
// (EDOCEnemyAIState), per docs/bots-ia.md #2. Deliberately a plain
// AAIController with hand-rolled Tick logic, NOT a Behavior
// Tree/Blackboard, so this compiles without any Editor-authored BT/BB
// assets (task explicitly asked for a C++ state machine here - a BT port
// is reasonable future work once the project is open in the Editor).
//
// The web version's manual per-wave flow-field grid (navGridRef) is
// replaced with the engine's built-in NavMesh pathfinding
// (AAIController::MoveToLocation) when there's no line of sight - see
// docs/bots-ia.md #4's recommendation. Requires a NavMeshBoundsVolume in
// the level (EDITOR_TODO.md).

#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "Data/DOCTypes.h"
#include "DOCEnemyAIController.generated.h"

class ADOCEnemyCharacter;

UCLASS()
class ADOCEnemyAIController : public AAIController
{
	GENERATED_BODY()

public:
	ADOCEnemyAIController();

	virtual void Tick(float DeltaSeconds) override;
	virtual void OnPossess(APawn* InPawn) override;

	// --- Tuning, exact values from GameApp.tsx (docs/bots-ia.md #3) ---

	// INITIAL_GRACE_PERIOD = 5000ms: no enemy fires this long after run start.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float InitialGracePeriodSeconds = 5.f;

	// WAVE_1_DAMAGE_MULT = 0.5: enemy damage is halved on wave 1.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float Wave1DamageMult = 0.5f;

	// wave1FireRateBuffer = 1.5 in enemyAI.ts: wave-1 enemies fire 1.5x
	// slower.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float Wave1FireRateMultiplier = 1.5f;

	// globalShootCooldown on wave 1: no two enemies fire within 1000ms of
	// each other.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float Wave1GlobalShotCooldownSeconds = 1.f;

	// Distance (uu) within which the strafe/flank component kicks in
	// regardless of approach/hold/retreat state.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float StrafeTriggerDistance = 150.f;

	// Melee (rusher, non-boss) attack range - fixed 110uu in enemyAI.ts
	// regardless of the data table's ShootRange.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|AI")
	float MeleeAttackRange = 110.f;

	// Sets which wave this enemy belongs to (affects fire-rate buffer/global
	// cooldown/minimum time before first shot) and the run start time used
	// for the initial grace period. Call right after SpawnActor, before the
	// controller starts ticking gameplay logic.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|AI")
	void SetSpawnContext(int32 InWaveNumber, float InRunStartTimeSeconds);

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|AI")
	EDOCEnemyAIState CurrentState = EDOCEnemyAIState::Approaching;

private:
	void UpdateAI(float DeltaSeconds);
	bool TraceLineOfSightToPlayer(FVector& OutEnemyEyeLoc, FVector& OutPlayerLoc, float& OutDistance) const;
	void TryFireAtPlayer(float Distance);
	APawn* GetPlayerPawn() const;

	int32 WaveNumber = 1;
	double RunStartTimeSeconds = 0.0;
	double SpawnTimeSeconds = 0.0;
	double NextShotAtSeconds = 0.0;
	double LastShotTimeSeconds = -1000.0;

	FVector LastTickLocation = FVector::ZeroVector;
	float StuckTimeSeconds = 0.f;

	TWeakObjectPtr<ADOCEnemyCharacter> ControlledEnemy;

	// Shared across every enemy AI instance in the current run - wave 1's
	// global fire-stagger is a run-wide rule, not a per-enemy one, matching
	// enemyAI.ts's lastEnemyShotTimeGlobal ref.
	static double LastGlobalEnemyShotTimeSeconds;
};
