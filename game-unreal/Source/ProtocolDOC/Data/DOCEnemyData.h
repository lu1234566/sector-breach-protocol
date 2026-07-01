// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. Row struct for the EnemyTypes DataTable
// (Data/CSV/EnemyTypes.csv -> DT_EnemyTypes). Values ported 1:1 from
// src/game-app/game/systems/enemyAI.ts and GameApp.tsx::spawnEnemies, see
// docs/bots-ia.md #1.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "DOCTypes.h"
#include "DOCEnemyData.generated.h"

USTRUCT(BlueprintType)
struct FDOCEnemyData : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	EDOCEnemyType EnemyType = EDOCEnemyType::Rifleman;

	// HP at wave 1, Normal difficulty, before the per-wave hpBuff and
	// per-difficulty HPMult multipliers (see docs/bots-ia.md #1-3).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float BaseHP = 0.f;

	// uu/s. Converted from the web version's per-tick units assuming
	// 1 old unit = 1 uu and a 60Hz tick (TICK_RATE in constants.ts):
	// BaseSpeed_uu_s = old_speed_per_tick * 60.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float BaseSpeed = 0.f;

	// Damage per successful shot/hit, before difficulty DamageMult and (for
	// Titan) the x2.5 boss multiplier already baked into this row's value.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float BaseDamage = 0.f;

	// Minimum time between shots, milliseconds (fixed 600ms for Titan
	// regardless of wave, per enemyAI.ts).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float FireRateMs = 0.f;

	// Preferred combat distance the AI tries to hold (uu). See
	// docs/bots-ia.md #2 step 3a.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float TargetDistance = 0.f;

	// Max distance at which this enemy will attempt to fire (uu).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	float ShootRange = 0.f;

	// Rusher-only: attacks are melee (no tracer/projectile, contact range).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	bool bIsMelee = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Enemy")
	bool bIsBoss = false;
};
