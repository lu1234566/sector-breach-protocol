// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. Row struct for the Weapons DataTable
// (Data/CSV/Weapons.csv -> DT_Weapons, imported in the Editor).
// Values ported 1:1 from src/game-app/game/constants.ts (WEAPONS), see
// docs/sistemas-a-portar.md #1.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "DOCTypes.h"
#include "DOCWeaponData.generated.h"

USTRUCT(BlueprintType)
struct FDOCWeaponData : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	EDOCWeaponType WeaponType = EDOCWeaponType::Pistol;

	// Damage per shot. For the shotgun this is the TOTAL damage of a full
	// blast (60), split evenly across PelletCount pellets at fire time - same
	// semantics as combat.ts::createHandleShoot (perPelletDamage = damage /
	// pelletCount).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float BaseDamage = 0.f;

	// Minimum time between shots, in milliseconds.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float FireRateMs = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float ReloadTimeMs = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	int32 MagazineSize = 0;

	// Screen-shake / recoil-kick magnitude, unitless (same scale as the web
	// version - re-tune once there's a real camera to feel it against).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float Recoil = 0.f;

	// Half-angle of the random spread cone, in radians.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float Spread = 0.f;

	// Max hit-scan distance in Unreal units (cm). Ported 1:1 from the web
	// game's abstract grid units (CELL_SIZE=64 => 1 old unit = 1 uu
	// assumption) - re-tune visually once a blockout exists, see
	// EDITOR_TODO.md.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	float Range = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	bool bIsScoped = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	bool bIsAutomatic = false;

	// 1 for every weapon except the shotgun (8).
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	int32 PelletCount = 1;

	// Placeholder-material tint until real weapon meshes exist.
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
	FLinearColor DebugColor = FLinearColor::White;
};
