// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. The Enhanced Input binding calls in
// SetupPlayerInputComponent (extra bound EDOCWeaponType arguments) rely on
// UEnhancedInputComponent::BindAction's variadic Vars... overload - double
// check this compiles as-is against 5.5's exact template signature.

#include "DOCCharacter.h"
#include "Weapons/DOCWeaponComponent.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputActionValue.h"

ADOCCharacter::ADOCCharacter()
{
	PrimaryActorTick.bCanEverTick = true;

	GetCapsuleComponent()->InitCapsuleSize(34.f, 96.f);

	bUseControllerRotationYaw = true;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;

	FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
	FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
	// Eye-height placeholder (capsule half-height 96 -> eyes near the top).
	// Adjust once a real character mesh exists, see EDITOR_TODO.md.
	FirstPersonCamera->SetRelativeLocation(FVector(0.f, 0.f, 74.f));
	FirstPersonCamera->bUsePawnControlRotation = true;

	WeaponComponent = CreateDefaultSubobject<UDOCWeaponComponent>(TEXT("WeaponComponent"));

	if (UCharacterMovementComponent* Movement = GetCharacterMovement())
	{
		Movement->bOrientRotationToMovement = false;
		Movement->MaxWalkSpeed = BaseWalkSpeed;
	}
}

void ADOCCharacter::BeginPlay()
{
	Super::BeginPlay();

	CurrentHP = MaxHP;

	if (APlayerController* PlayerController = Cast<APlayerController>(Controller))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
				ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PlayerController->GetLocalPlayer()))
		{
			if (DefaultMappingContext)
			{
				Subsystem->AddMappingContext(DefaultMappingContext, 0);
			}
		}
	}
}

void ADOCCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// ADS ramp: web version steps adsProgress by +-0.1 per tick at an
	// assumed 60Hz (GameApp.tsx update()) => 6.0/second, see
	// AdsRampPerSecond. FInterpConstantTo gives the same linear ramp
	// independent of frame rate.
	const float TargetAds = bIsAiming ? 1.f : 0.f;
	AdsProgress = FMath::FInterpConstantTo(AdsProgress, TargetAds, DeltaSeconds, AdsRampPerSecond);

	UpdateMovementSpeed();

	if (WeaponComponent)
	{
		WeaponComponent->SetAiming(bIsAiming, AdsProgress);

		// Automatic weapons keep firing while the trigger is held, matching
		// GameApp.tsx update(): `if (keys.m_left && WEAPONS[cur].isAuto) handleShoot()`.
		if (bWantsToFire && WeaponComponent->IsCurrentWeaponAutomatic())
		{
			WeaponComponent->TryFire();
		}
	}
}

void ADOCCharacter::UpdateMovementSpeed()
{
	if (UCharacterMovementComponent* Movement = GetCharacterMovement())
	{
		const float BaseSpeed = bWantsToSprint ? SprintSpeed : BaseWalkSpeed;
		// Web version: moveSpeed * (1 - adsProgress * 0.5) - full ADS caps
		// movement at 50% speed.
		Movement->MaxWalkSpeed = BaseSpeed * (1.f - AdsProgress * AdsMoveSpeedPenalty);
	}
}

void ADOCCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	if (UEnhancedInputComponent* EnhancedInputComponent = Cast<UEnhancedInputComponent>(PlayerInputComponent))
	{
		if (MoveAction)
		{
			EnhancedInputComponent->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ADOCCharacter::Input_Move);
		}
		if (LookAction)
		{
			EnhancedInputComponent->BindAction(LookAction, ETriggerEvent::Triggered, this, &ADOCCharacter::Input_Look);
		}
		if (SprintAction)
		{
			EnhancedInputComponent->BindAction(SprintAction, ETriggerEvent::Started, this, &ADOCCharacter::Input_SprintStarted);
			EnhancedInputComponent->BindAction(SprintAction, ETriggerEvent::Completed, this, &ADOCCharacter::Input_SprintStopped);
			EnhancedInputComponent->BindAction(SprintAction, ETriggerEvent::Canceled, this, &ADOCCharacter::Input_SprintStopped);
		}
		if (FireAction)
		{
			EnhancedInputComponent->BindAction(FireAction, ETriggerEvent::Started, this, &ADOCCharacter::Input_FireStarted);
			EnhancedInputComponent->BindAction(FireAction, ETriggerEvent::Completed, this, &ADOCCharacter::Input_FireStopped);
			EnhancedInputComponent->BindAction(FireAction, ETriggerEvent::Canceled, this, &ADOCCharacter::Input_FireStopped);
		}
		if (AimAction)
		{
			EnhancedInputComponent->BindAction(AimAction, ETriggerEvent::Started, this, &ADOCCharacter::Input_AimStarted);
			EnhancedInputComponent->BindAction(AimAction, ETriggerEvent::Completed, this, &ADOCCharacter::Input_AimStopped);
			EnhancedInputComponent->BindAction(AimAction, ETriggerEvent::Canceled, this, &ADOCCharacter::Input_AimStopped);
		}
		if (ReloadAction)
		{
			EnhancedInputComponent->BindAction(ReloadAction, ETriggerEvent::Started, this, &ADOCCharacter::Input_Reload);
		}
		if (SwitchWeapon1Action)
		{
			EnhancedInputComponent->BindAction(SwitchWeapon1Action, ETriggerEvent::Started, this, &ADOCCharacter::Input_SwitchWeapon, EDOCWeaponType::Pistol);
		}
		if (SwitchWeapon2Action)
		{
			EnhancedInputComponent->BindAction(SwitchWeapon2Action, ETriggerEvent::Started, this, &ADOCCharacter::Input_SwitchWeapon, EDOCWeaponType::Rifle);
		}
		if (SwitchWeapon3Action)
		{
			EnhancedInputComponent->BindAction(SwitchWeapon3Action, ETriggerEvent::Started, this, &ADOCCharacter::Input_SwitchWeapon, EDOCWeaponType::Shotgun);
		}
		if (SwitchWeapon4Action)
		{
			EnhancedInputComponent->BindAction(SwitchWeapon4Action, ETriggerEvent::Started, this, &ADOCCharacter::Input_SwitchWeapon, EDOCWeaponType::Sniper);
		}
		if (PauseAction)
		{
			EnhancedInputComponent->BindAction(PauseAction, ETriggerEvent::Started, this, &ADOCCharacter::Input_Pause);
		}
	}
}

void ADOCCharacter::Input_Move(const FInputActionValue& Value)
{
	const FVector2D MoveValue = Value.Get<FVector2D>();
	if (!Controller)
	{
		return;
	}

	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FVector ForwardDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X);
	const FVector RightDirection = FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y);

	AddMovementInput(ForwardDirection, MoveValue.Y);
	AddMovementInput(RightDirection, MoveValue.X);
}

void ADOCCharacter::Input_Look(const FInputActionValue& Value)
{
	const FVector2D LookValue = Value.Get<FVector2D>();

	// Web version narrows sensitivity while aiming (baseX 0.001 ADS vs 0.002
	// hip-fire in useInputSystem.ts) - approximate with a flat 0.5x here.
	const float AdsSensitivityMult = bIsAiming ? 0.5f : 1.f;
	const float XSign = bInvertLookX ? -1.f : 1.f;
	const float YSign = bInvertLookY ? -1.f : 1.f;

	AddControllerYawInput(LookValue.X * MouseSensitivityX * XSign * AdsSensitivityMult);
	AddControllerPitchInput(LookValue.Y * MouseSensitivityY * YSign * AdsSensitivityMult);

	// Optional legacy-parity clamp. The idiomatic Unreal approach is
	// PlayerCameraManager->ViewPitchMin/Max instead of a manual clamp here -
	// revisit once there's a PlayerCameraManager subclass to set that on.
	if (bClampPitchToLegacyRange && Controller)
	{
		FRotator ControlRotation = Controller->GetControlRotation();
		const float ClampedPitch = FMath::Clamp(FRotator::NormalizeAxis(ControlRotation.Pitch), -LegacyPitchLimitDegrees, LegacyPitchLimitDegrees);
		ControlRotation.Pitch = ClampedPitch;
		Controller->SetControlRotation(ControlRotation);
	}
}

void ADOCCharacter::Input_SprintStarted()
{
	bWantsToSprint = true;
}

void ADOCCharacter::Input_SprintStopped()
{
	bWantsToSprint = false;
}

void ADOCCharacter::Input_FireStarted()
{
	bWantsToFire = true;
	if (WeaponComponent)
	{
		WeaponComponent->TryFire();
	}
}

void ADOCCharacter::Input_FireStopped()
{
	bWantsToFire = false;
}

void ADOCCharacter::Input_AimStarted()
{
	bIsAiming = true;
}

void ADOCCharacter::Input_AimStopped()
{
	bIsAiming = false;
}

void ADOCCharacter::Input_Reload()
{
	if (WeaponComponent)
	{
		WeaponComponent->StartReload();
	}
}

void ADOCCharacter::Input_SwitchWeapon(EDOCWeaponType RequestedWeapon)
{
	if (WeaponComponent)
	{
		WeaponComponent->SwitchWeapon(RequestedWeapon);
	}
}

void ADOCCharacter::Input_Pause()
{
	OnPauseRequested.Broadcast();
}

float ADOCCharacter::TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float AppliedDamage = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	CurrentHP = FMath::Clamp(CurrentHP - AppliedDamage, 0.f, MaxHP);
	// Run-ending on CurrentHP==0 is GameMode's job (mirrors GameApp.tsx
	// endRun(false)) - see GameMode/DOCGameMode.cpp, which should bind to
	// this via a health-changed delegate once the HUD needs it too.
	return AppliedDamage;
}

void ADOCCharacter::ApplyArmorPlatingLevel(int32 Level)
{
	// +5 max HP per level, matches constants.ts UPGRADES.armorPlating.
	MaxHP = 100.f + Level * 5.f;
	CurrentHP = FMath::Min(CurrentHP, MaxHP);
}

void ADOCCharacter::ApplyHealing(float Amount)
{
	CurrentHP = FMath::Clamp(CurrentHP + Amount, 0.f, MaxHP);
}
