// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCWeaponComponent.h"
#include "Data/DOCWeaponData.h"
#include "Data/DOCUpgradeData.h"
#include "Camera/CameraComponent.h"
#include "Engine/DataTable.h"
#include "TimerManager.h"
#include "Kismet/GameplayStatics.h"
#include "DrawDebugHelpers.h"

namespace DOCWeaponRows
{
	static FName ToRowName(EDOCWeaponType Type)
	{
		switch (Type)
		{
		case EDOCWeaponType::Pistol: return TEXT("Pistol");
		case EDOCWeaponType::Rifle: return TEXT("Rifle");
		case EDOCWeaponType::Shotgun: return TEXT("Shotgun");
		case EDOCWeaponType::Sniper: return TEXT("Sniper");
		default: return NAME_None;
		}
	}
}

UDOCWeaponComponent::UDOCWeaponComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UDOCWeaponComponent::BeginPlay()
{
	Super::BeginPlay();

	ReserveAmmo = BaseReserveAmmo;

	if (AActor* Owner = GetOwner())
	{
		CachedCamera = Owner->FindComponentByClass<UCameraComponent>();
	}

	// Start every weapon with a full magazine, matching the web version's
	// initial ammo state (mag = magSize on spawn).
	for (EDOCWeaponType Type : { EDOCWeaponType::Pistol, EDOCWeaponType::Rifle, EDOCWeaponType::Shotgun, EDOCWeaponType::Sniper })
	{
		if (const FDOCWeaponData* Data = GetWeaponData(Type))
		{
			GetOrAddRuntimeState(Type).MagAmmo = Data->MagazineSize;
		}
	}
}

const FDOCWeaponData* UDOCWeaponComponent::GetWeaponData(EDOCWeaponType Weapon) const
{
	if (!WeaponDataTable)
	{
		return nullptr;
	}
	const FName RowName = DOCWeaponRows::ToRowName(Weapon);
	static const FString Context(TEXT("UDOCWeaponComponent::GetWeaponData"));
	return WeaponDataTable->FindRow<FDOCWeaponData>(RowName, Context, /*bWarnIfRowMissing=*/true);
}

const FDOCWeaponData* UDOCWeaponComponent::GetCurrentWeaponData() const
{
	return GetWeaponData(CurrentWeapon);
}

FDOCWeaponRuntimeState& UDOCWeaponComponent::GetOrAddRuntimeState(EDOCWeaponType Weapon)
{
	return RuntimeStates.FindOrAdd(Weapon);
}

bool UDOCWeaponComponent::IsCurrentWeaponAutomatic() const
{
	const FDOCWeaponData* Data = GetCurrentWeaponData();
	return Data ? Data->bIsAutomatic : false;
}

int32 UDOCWeaponComponent::GetCurrentMagAmmo() const
{
	if (const FDOCWeaponRuntimeState* State = RuntimeStates.Find(CurrentWeapon))
	{
		return State->MagAmmo;
	}
	return 0;
}

void UDOCWeaponComponent::SetAiming(bool bAiming, float AdsProgress)
{
	bIsAimingDownSights = bAiming;
	CurrentAdsProgress = FMath::Clamp(AdsProgress, 0.f, 1.f);
}

void UDOCWeaponComponent::SwitchWeapon(EDOCWeaponType NewWeapon)
{
	if (NewWeapon == CurrentWeapon)
	{
		return;
	}

	// Cancel any in-flight reload - matches useInputSystem.ts weapon-switch
	// handling (cancels reload timeout, clears isReloading).
	if (bIsReloading)
	{
		GetWorld()->GetTimerManager().ClearTimer(ReloadTimerHandle);
		bIsReloading = false;
	}

	CurrentWeapon = NewWeapon;
	GetOrAddRuntimeState(CurrentWeapon);
}

void UDOCWeaponComponent::SetWeaponUpgradeLevels(EDOCWeaponType Weapon, int32 DamageLevel, int32 StabilityLevel, int32 ReloadLevel)
{
	FDOCWeaponRuntimeState& State = GetOrAddRuntimeState(Weapon);
	State.DamageLevel = DamageLevel;
	State.StabilityLevel = StabilityLevel;
	State.ReloadLevel = ReloadLevel;
}

bool UDOCWeaponComponent::TryFire()
{
	if (bIsReloading)
	{
		return false;
	}

	const FDOCWeaponData* Weapon = GetCurrentWeaponData();
	if (!Weapon)
	{
		return false;
	}

	const double Now = FPlatformTime::Seconds();
	if ((Now - LastShotTimeSeconds) * 1000.0 < Weapon->FireRateMs)
	{
		return false;
	}

	FDOCWeaponRuntimeState& State = GetOrAddRuntimeState(CurrentWeapon);
	if (State.MagAmmo <= 0)
	{
		if (ReserveAmmo > 0)
		{
			StartReload();
		}
		return false;
	}

	LastShotTimeSeconds = Now;
	--State.MagAmmo;

	FireLineTrace(*Weapon);
	return true;
}

void UDOCWeaponComponent::FireLineTrace(const FDOCWeaponData& Weapon)
{
	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	UCameraComponent* Camera = CachedCamera.Get();
	const FVector TraceStart = Camera ? Camera->GetComponentLocation() : Owner->GetActorLocation();
	const FVector AimForward = Camera ? Camera->GetForwardVector() : Owner->GetActorForwardVector();

	const FDOCWeaponRuntimeState& State = GetOrAddRuntimeState(CurrentWeapon);
	const float DamageMult = 1.f + State.DamageLevel * 0.05f;
	const float StabilityMult = 1.f - State.StabilityLevel * 0.05f;

	const bool bIsShotgun = Weapon.PelletCount > 1;
	const float PerPelletDamage = (Weapon.BaseDamage * DamageMult) / FMath::Max(1, Weapon.PelletCount);

	// Shotgun pellet cone is fixed and wider; other weapons narrow under ADS
	// and benefit from the Stability upgrade - matches
	// combat.ts::createHandleShoot pelletSpread computation.
	const float PelletSpread = bIsShotgun
		? Weapon.Spread * 1.4f
		: Weapon.Spread * (1.f - CurrentAdsProgress * 0.8f) * StabilityMult;

	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(Owner);

	for (int32 PelletIndex = 0; PelletIndex < Weapon.PelletCount; ++PelletIndex)
	{
		const float Spread = FMath::FRandRange(-0.5f, 0.5f) * PelletSpread;
		// Yaw-only spread, matching the web version's 2D spread on the
		// horizontal plane. Revisit with vertical spread once real weapon
		// feel is being tuned in-editor.
		const FRotator SpreadRotation(0.f, FMath::RadiansToDegrees(Spread), 0.f);
		const FVector ShotDirection = SpreadRotation.RotateVector(AimForward);
		const FVector TraceEnd = TraceStart + ShotDirection * Weapon.Range;

		FHitResult Hit;
		const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, TraceStart, TraceEnd, ECC_Pawn, QueryParams);

#if WITH_EDITOR
		DrawDebugLine(GetWorld(), TraceStart, bHit ? Hit.ImpactPoint : TraceEnd, FColor::Yellow, false, 0.15f, 0, 1.f);
#endif

		if (bHit && Hit.GetActor())
		{
			// Enemy damage handling: ADOCEnemyCharacter::TakeDamage picks
			// this up (see AI/DOCEnemyCharacter.cpp). Kill scoring, drops
			// and killfeed text live there, not here, mirroring
			// combat.ts::createHandleShoot's post-kill block.
			UGameplayStatics::ApplyDamage(Hit.GetActor(), PerPelletDamage, nullptr, Owner, nullptr);
		}
	}
}

void UDOCWeaponComponent::StartReload()
{
	const FDOCWeaponData* Weapon = GetCurrentWeaponData();
	if (!Weapon || bIsReloading || ReserveAmmo <= 0)
	{
		return;
	}

	const FDOCWeaponRuntimeState& State = GetOrAddRuntimeState(CurrentWeapon);
	if (State.MagAmmo >= Weapon->MagazineSize)
	{
		return;
	}

	bIsReloading = true;

	// -4%/level per-weapon reload upgrade stacks multiplicatively with the
	// -5%/level global QuickReload upgrade (GlobalReloadTimeMult), matching
	// combat.ts::createReload's finalReloadTime formula.
	const float WeaponReloadMult = 1.f - State.ReloadLevel * 0.04f;
	const float FinalReloadTimeSeconds = (Weapon->ReloadTimeMs / 1000.f) * GlobalReloadTimeMult * WeaponReloadMult;

	GetWorld()->GetTimerManager().SetTimer(ReloadTimerHandle, this, &UDOCWeaponComponent::FinishReload, FMath::Max(0.05f, FinalReloadTimeSeconds), false);
}

void UDOCWeaponComponent::FinishReload()
{
	const FDOCWeaponData* Weapon = GetCurrentWeaponData();
	bIsReloading = false;
	if (!Weapon)
	{
		return;
	}

	FDOCWeaponRuntimeState& State = GetOrAddRuntimeState(CurrentWeapon);
	const int32 Needed = Weapon->MagazineSize - State.MagAmmo;
	const int32 Taken = FMath::Min(Needed, ReserveAmmo);
	State.MagAmmo += Taken;
	ReserveAmmo -= Taken;
}
