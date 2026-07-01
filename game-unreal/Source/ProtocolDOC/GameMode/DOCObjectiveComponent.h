// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Per-wave objective runtime, ported from src/game-app/game/objectives.ts.
// See docs/scorestreaks.md #2.
//
// Simplification vs. the web version: objectives.ts computes hack/defend
// zone placement at runtime via BFS over reachable grid cells
// (arenaCenter/extractCorner), because the arena is a logical grid. Unreal
// levels are hand-authored geometry, so this component instead looks up a
// zone actor by tag (placed per level in the Editor) - see
// docs/GDD.md #7 and EDITOR_TODO.md.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/DOCTypes.h"
#include "DOCObjectiveComponent.generated.h"

class UDataTable;
struct FDOCWaveObjectiveData;

USTRUCT(BlueprintType)
struct FDOCObjectiveRuntimeState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	EDOCObjectiveKind Kind = EDOCObjectiveKind::Eliminate;

	UPROPERTY(BlueprintReadOnly)
	FText Label;

	UPROPERTY(BlueprintReadOnly)
	FName ZoneTag = NAME_None;

	// Hack/Defend: seconds remaining in the countdown. Extract: seconds
	// remaining once the zone is active.
	UPROPERTY(BlueprintReadOnly)
	float TimerSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly)
	float TimeLimitSeconds = 0.f;

	UPROPERTY(BlueprintReadOnly)
	bool bInZone = false;

	UPROPERTY(BlueprintReadOnly)
	int32 KillCount = 0;

	UPROPERTY(BlueprintReadOnly)
	int32 KillTarget = 0;

	UPROPERTY(BlueprintReadOnly)
	float CoreHp = 0.f;

	UPROPERTY(BlueprintReadOnly)
	float CoreMaxHp = 0.f;

	UPROPERTY(BlueprintReadOnly)
	bool bExtractActive = false;

	UPROPERTY(BlueprintReadOnly)
	EDOCObjectiveStatus Status = EDOCObjectiveStatus::Active;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FDOCObjectiveResolvedSignature, bool, bSucceeded);

UCLASS(ClassGroup = (ProtocolDOC), meta = (BlueprintSpawnableComponent))
class UDOCObjectiveComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UDOCObjectiveComponent();

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Objective")
	TObjectPtr<UDataTable> WaveObjectiveTable;

	// Approximates objectives.ts's CELL_SIZE*1.4 (Extract) / *1.6
	// (Hack/Defend) zone radii (CELL_SIZE=64 => ~90/~102uu) with a single
	// tunable radius - re-split per kind once real trigger volumes exist.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Objective")
	float ObjectiveZoneRadius = 100.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Objective")
	FDOCObjectiveRuntimeState Runtime;

	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Objective")
	FDOCObjectiveResolvedSignature OnObjectiveResolved;

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Objective")
	void StartObjectiveForWave(int32 WaveNumber, bool bEndless);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Objective")
	void TickObjective(float DeltaSeconds);

	// Called by DOCGameMode on every enemy kill - counts toward Extract's
	// kill threshold.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Objective")
	void NotifyEnemyKilled();

	// Called by DOCGameMode once UDOCWaveManagerComponent reports the wave
	// fully cleared - resolves Eliminate objectives.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Objective")
	void NotifyAllEnemiesCleared();

	// Hook for a future "core under attack" system once enemies can target
	// it - not implemented in this pass, see EDITOR_TODO.md.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Objective")
	void ApplyCoreDamage(float Damage);

private:
	const FDOCWaveObjectiveData* FindObjectiveRow(int32 WaveNumber, bool bEndless) const;
	AActor* FindZoneActor() const;
	bool IsPlayerInZone() const;
	void Resolve(bool bSucceeded);
};
