// NOTE: written without compiling against Unreal Engine 5.5 - this project
// has never been opened in the Editor or built. Expect to fix small API
// mismatches on first compile (see /EDITOR_TODO.md).
//
// Shared enums for Protocol DOC gameplay. Values map 1:1 to the web game's
// docs/sistemas-a-portar.md, docs/bots-ia.md and docs/scorestreaks.md.

#pragma once

#include "CoreMinimal.h"
#include "DOCTypes.generated.h"

UENUM(BlueprintType)
enum class EDOCWeaponType : uint8
{
	Pistol,
	Rifle,
	Shotgun,
	Sniper
};

UENUM(BlueprintType)
enum class EDOCEnemyType : uint8
{
	Rusher,
	Rifleman,
	Sniper,
	Titan
};

UENUM(BlueprintType)
enum class EDOCDifficulty : uint8
{
	Recruit,
	Normal,
	Veteran,
	Nightmare
};

// Campaign = fixed 6-wave run ending in Extract. Endless = campaign pacing
// for waves 1-5, then an open-ended hack/defend/eliminate/boss rotation.
// See docs/scorestreaks.md #1.
UENUM(BlueprintType)
enum class EDOCPlayMode : uint8
{
	Campaign,
	Endless
};

UENUM(BlueprintType)
enum class EDOCObjectiveKind : uint8
{
	Eliminate,
	Hack,
	Defend,
	Extract
};

UENUM(BlueprintType)
enum class EDOCObjectiveStatus : uint8
{
	Active,
	Complete,
	Failed
};

// Mirrors the implicit per-frame decision tree in the web AI
// (src/game-app/game/systems/enemyAI.ts), made explicit as a real state
// machine. See docs/bots-ia.md #2.
UENUM(BlueprintType)
enum class EDOCEnemyAIState : uint8
{
	// Has line of sight, closing the distance to TargetDistance.
	Approaching,
	// Has line of sight, within +-tolerance of TargetDistance; strafes if
	// too close, holds fire cadence.
	Holding,
	// Has line of sight but is closer than (TargetDistance - tolerance);
	// backs away while still shooting (ranged types only).
	Retreating,
	// No line of sight - following the NavMesh path toward the player.
	NavigatingToLineOfSight,
	// Stuck-detection escape hatch: forced perpendicular nudge.
	Unstucking
};
