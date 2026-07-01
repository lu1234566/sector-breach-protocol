// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Weapon firing/reload logic, ported from
// src/game-app/game/systems/combat.ts (createHandleShoot/createReload), see
// docs/sistemas-a-portar.md #1. Values come from DT_Weapons
// (Data/CSV/Weapons.csv) at runtime, not hardcoded, so balance changes never
// require a recompile.
//
// Intentionally NOT ported: the web version's wall-decal system and the
// grid-cell door/barrel destruction (cell===2 / cell===3) tied to the
// raycast - those depended on the logical tile grid, which has no Unreal
// equivalent until real level geometry exists. See EDITOR_TODO.md.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Data/DOCTypes.h"
#include "DOCWeaponComponent.generated.h"

class UDataTable;
struct FDOCWeaponData;

USTRUCT(BlueprintType)
struct FDOCWeaponRuntimeState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	int32 MagAmmo = 0;

	// Per-weapon upgrade levels (0-5 each), see docs/scorestreaks.md #4.
	UPROPERTY(BlueprintReadOnly)
	int32 DamageLevel = 0;

	UPROPERTY(BlueprintReadOnly)
	int32 StabilityLevel = 0;

	UPROPERTY(BlueprintReadOnly)
	int32 ReloadLevel = 0;
};

UCLASS(ClassGroup = (ProtocolDOC), meta = (BlueprintSpawnableComponent))
class UDOCWeaponComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UDOCWeaponComponent();

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Weapon")
	TObjectPtr<UDataTable> WeaponDataTable;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Weapon")
	TObjectPtr<UDataTable> WeaponUpgradeConfigTable;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Weapon")
	EDOCWeaponType CurrentWeapon = EDOCWeaponType::Pistol;

	// Shared reserve ammo pool, matches ammo.reserve in GameApp.tsx (all
	// weapons draw from/reload against the same reserve counter).
	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Weapon")
	int32 ReserveAmmo = 120;

	// Base value before the AmmoReserve upgrade (+20/level); apply the bonus
	// via SetBaseReserveAmmo once UDOCEconomySubsystem is wired up.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Weapon")
	int32 BaseReserveAmmo = 120;

	// 1 - (QuickReload upgrade level * 0.05), applied on top of the
	// per-weapon ReloadLevel reduction. See docs/scorestreaks.md #4.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Weapon")
	float GlobalReloadTimeMult = 1.f;

	// Attempts to fire the current weapon; enforces fire-rate cooldown,
	// ammo, and reload-state exactly like combat.ts::createHandleShoot.
	// Returns true if a shot was actually fired.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	bool TryFire();

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	void StartReload();

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	void SwitchWeapon(EDOCWeaponType NewWeapon);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	void SetAiming(bool bAiming, float AdsProgress);

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Weapon")
	bool IsCurrentWeaponAutomatic() const;

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Weapon")
	int32 GetCurrentMagAmmo() const;

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Weapon")
	bool IsReloading() const { return bIsReloading; }

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	void SetWeaponUpgradeLevels(EDOCWeaponType Weapon, int32 DamageLevel, int32 StabilityLevel, int32 ReloadLevel);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Weapon")
	void SetBaseReserveAmmo(int32 NewBaseReserveAmmo) { BaseReserveAmmo = NewBaseReserveAmmo; }

protected:
	virtual void BeginPlay() override;

private:
	const FDOCWeaponData* GetWeaponData(EDOCWeaponType Weapon) const;
	const FDOCWeaponData* GetCurrentWeaponData() const;
	FDOCWeaponRuntimeState& GetOrAddRuntimeState(EDOCWeaponType Weapon);

	void FireLineTrace(const FDOCWeaponData& Weapon);
	void FinishReload();

	TMap<EDOCWeaponType, FDOCWeaponRuntimeState> RuntimeStates;

	double LastShotTimeSeconds = 0.0;
	bool bIsReloading = false;
	FTimerHandle ReloadTimerHandle;

	float CurrentAdsProgress = 0.f;
	bool bIsAimingDownSights = false;

	TWeakObjectPtr<class UCameraComponent> CachedCamera;
};
