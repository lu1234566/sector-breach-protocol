// NOTE: written without compiling against Unreal Engine 5.5 - this project
// has never been opened in the Editor or built. Expect to fix small API
// mismatches on first compile (see /EDITOR_TODO.md), especially around the
// Enhanced Input binding signatures.
//
// Player character. Movement/camera/ADS values ported from
// src/game-app/GameApp.tsx (the `update()` player-movement block) and
// src/game-app/game/systems/useInputSystem.ts, see
// docs/controles-touch.md. Input Actions/Mapping Context referenced here are
// Editor-only assets that still need to be created - see EDITOR_TODO.md.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Data/DOCTypes.h"
#include "DOCCharacter.generated.h"

class UCameraComponent;
class UInputAction;
class UInputMappingContext;
class UDOCWeaponComponent;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FDOCPauseRequestedSignature);

UCLASS()
class ADOCCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ADOCCharacter();

	// Applies the ArmorPlating upgrade bonus (+5 max HP/level, see
	// docs/scorestreaks.md #4) - call after spawn once
	// UDOCEconomySubsystem is available.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Combat")
	void ApplyArmorPlatingLevel(int32 Level);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Combat")
	void ApplyHealing(float Amount);

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Combat")
	float GetHealthFraction() const { return MaxHP > 0.f ? CurrentHP / MaxHP : 0.f; }

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual float TakeDamage(float DamageAmount, struct FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser) override;

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Protocol DOC|Camera")
	TObjectPtr<UCameraComponent> FirstPersonCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Protocol DOC|Weapon")
	TObjectPtr<UDOCWeaponComponent> WeaponComponent;

	// --- Enhanced Input assets, assigned in the Editor (EDITOR_TODO.md) ---

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> SprintAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> FireAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> AimAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> ReloadAction;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> SwitchWeapon1Action;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> SwitchWeapon2Action;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> SwitchWeapon3Action;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> SwitchWeapon4Action;

	UPROPERTY(EditDefaultsOnly, Category = "Protocol DOC|Input")
	TObjectPtr<UInputAction> PauseAction;

	// Broadcast on Esc/Pause input; GameMode/HUD hook into this rather than
	// the character calling into them directly.
	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Input")
	FDOCPauseRequestedSignature OnPauseRequested;

	// --- Movement tuning (docs/controles-touch.md #2) ---
	// uu/s. Ported from the web version's 4 units/tick @ 60Hz (4*60=240).
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Movement")
	float BaseWalkSpeed = 240.f;

	// uu/s. Ported from the web version's 6 units/tick @ 60Hz (6*60=360).
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Movement")
	float SprintSpeed = 360.f;

	// --- Camera / look tuning ---
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera")
	float MouseSensitivityX = 1.f;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera")
	float MouseSensitivityY = 1.f;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera")
	bool bInvertLookX = false;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera")
	bool bInvertLookY = false;

	// The web version hard-clamps pitch to +-25 degrees
	// (useInputSystem.ts::handleMouseMove). A real 3D engine doesn't need
	// that limitation - default this OFF and revisit during playtesting
	// (see docs/GDD.md #3). Kept available for a legacy-feel comparison.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera")
	bool bClampPitchToLegacyRange = false;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Camera", meta = (EditCondition = "bClampPitchToLegacyRange"))
	float LegacyPitchLimitDegrees = 25.f;

	// --- Combat state ---
	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Combat")
	float CurrentHP = 100.f;

	// 100 base + 5 per ArmorPlating level (max level 5 => 125).
	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Combat")
	float MaxHP = 100.f;

	// --- ADS state (GameApp.tsx update(): adsProgress ramps +-0.1/tick@60Hz) ---
	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Aim")
	float AdsProgress = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Aim")
	bool bIsAiming = false;

	// 0.1 per tick at the web version's assumed 60Hz tick => 6.0/second.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Aim")
	float AdsRampPerSecond = 6.f;

	// Movement speed multiplier at full ADS (adsProgress=1): web version cuts
	// speed by up to 50% while aiming (moveSpeed * (1 - adsProgress*0.5)).
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Aim")
	float AdsMoveSpeedPenalty = 0.5f;

private:
	void Input_Move(const FInputActionValue& Value);
	void Input_Look(const FInputActionValue& Value);
	void Input_SprintStarted();
	void Input_SprintStopped();
	void Input_FireStarted();
	void Input_FireStopped();
	void Input_AimStarted();
	void Input_AimStopped();
	void Input_Reload();
	void Input_SwitchWeapon(EDOCWeaponType RequestedWeapon);
	void Input_Pause();

	void UpdateMovementSpeed();

	bool bWantsToSprint = false;
	bool bWantsToFire = false;
};
