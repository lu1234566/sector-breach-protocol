// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. Row struct for the WaveObjectives DataTable
// (Data/CSV/WaveObjectives.csv -> DT_WaveObjectives). Values ported 1:1 from
// src/game-app/game/objectives.ts, see docs/scorestreaks.md #2.
//
// Campaign waves use RowName "Wave_1".."Wave_6" and the Wave field is
// authoritative. Endless rotation waves (wave >= 6 in Endless mode) use
// RowName "Endless_Boss" / "Endless_Mod0" / "Endless_Mod1" / "Endless_Mod2"
// and the Wave field is unused (0) - selection logic lives in
// UDOCObjectiveComponent::GetWaveObjective, mirroring
// objectives.ts::endlessObjective's wave%5==0 / wave%3 rules.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "DOCTypes.h"
#include "DOCWaveObjectiveData.generated.h"

USTRUCT(BlueprintType)
struct FDOCWaveObjectiveData : public FTableRowBase
{
	GENERATED_BODY()

	// Campaign wave number (1-6). Ignored (0) for Endless_* rotation rows.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	int32 Wave = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	EDOCObjectiveKind Kind = EDOCObjectiveKind::Eliminate;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	FText Label;

	// Hack/Defend countdown duration, milliseconds. 0 for Eliminate/Extract.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	float DurationMs = 0.f;

	// Extract-only: kills required before the extraction zone opens.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	int32 KillThreshold = 0;

	// Extract-only: time limit once the zone is open, milliseconds.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	float TimeLimitMs = 0.f;

	// Defend-only: HP of the core being defended.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	float CoreMaxHp = 0.f;

	// Tag of the objective-zone actor placed in the level for this objective
	// (e.g. "ObjectiveZone_Hack"). "None" for Eliminate, which has no zone.
	// Replaces the web version's runtime BFS-reachability zone placement
	// (objectives.ts::arenaCenter/extractCorner) - see EDITOR_TODO.md, zones
	// must be hand-placed per level instead.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
	FName ZoneTag = NAME_None;
};
