// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. Row structs for the Upgrades and WeaponUpgradeConfig
// DataTables (Data/CSV/Upgrades.csv, Data/CSV/WeaponUpgradeConfig.csv).
// Values ported 1:1 from src/game-app/game/constants.ts (UPGRADES,
// WEAPON_UPGRADE_COSTS, MAX_WEAPON_LEVEL), see docs/scorestreaks.md #4.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "DOCUpgradeData.generated.h"

// Global run-persistent upgrade (armorPlating / ammoReserve / quickReload /
// scavenger). RowName is the upgrade id used by UDOCEconomySubsystem.
USTRUCT(BlueprintType)
struct FDOCUpgradeData : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Upgrade")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Upgrade")
	FText Description;

	// Credit cost to go from level N to N+1, index 0 = cost of level 1.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Upgrade")
	TArray<int32> Costs;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Upgrade")
	int32 MaxLevel = 5;

	// Magnitude of the effect per level - interpretation is per-upgrade-id
	// (armorPlating: +HP, ammoReserve: +reserve ammo, quickReload/scavenger:
	// fractional multiplier e.g. 0.05 = 5%). See
	// UDOCEconomySubsystem::ApplyUpgradeEffects.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Upgrade")
	float EffectPerLevel = 0.f;
};

// Shared config for the three per-weapon upgrade stats (damage / stability /
// reload). All three use the same cost table and max level in the web
// version - only the per-level effect differs, and that's hardcoded in
// UDOCWeaponComponent to match constants.ts exactly (damage +5%/lvl,
// stability -5% spread&recoil/lvl, reload -4% reload time/lvl).
USTRUCT(BlueprintType)
struct FDOCWeaponUpgradeConfigData : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "WeaponUpgrade")
	int32 MaxLevel = 5;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "WeaponUpgrade")
	float DamagePerLevel = 0.05f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "WeaponUpgrade")
	float StabilityPerLevel = 0.05f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "WeaponUpgrade")
	float ReloadPerLevel = 0.04f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "WeaponUpgrade")
	TArray<int32> Costs;
};
