// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCEconomySubsystem.h"
#include "DOCSaveGame.h"
#include "Data/DOCUpgradeData.h"
#include "Data/DOCDifficultyData.h"
#include "Player/DOCCharacter.h"
#include "Weapons/DOCWeaponComponent.h"
#include "Engine/DataTable.h"
#include "Kismet/GameplayStatics.h"

namespace DOCEconomyRows
{
	// Duplicated from DOCWeaponComponent.cpp / DOCWaveManagerComponent.cpp
	// rather than shared, to keep each system's first draft self-contained -
	// worth consolidating into one shared helper once the project builds
	// (see EDITOR_TODO.md).
	static FName WeaponRowName(EDOCWeaponType Type)
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

	static FName DifficultyRowName(EDOCDifficulty Difficulty)
	{
		switch (Difficulty)
		{
		case EDOCDifficulty::Recruit: return TEXT("Recruit");
		case EDOCDifficulty::Normal: return TEXT("Normal");
		case EDOCDifficulty::Veteran: return TEXT("Veteran");
		case EDOCDifficulty::Nightmare: return TEXT("Nightmare");
		default: return NAME_None;
		}
	}
}

void UDOCEconomySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	LoadOrCreateSave();
}

void UDOCEconomySubsystem::Deinitialize()
{
	Super::Deinitialize();
}

void UDOCEconomySubsystem::LoadOrCreateSave()
{
	if (UGameplayStatics::DoesSaveGameExist(SaveSlotName, 0))
	{
		SaveData = Cast<UDOCSaveGame>(UGameplayStatics::LoadGameFromSlot(SaveSlotName, 0));
	}
	if (!SaveData)
	{
		SaveData = Cast<UDOCSaveGame>(UGameplayStatics::CreateSaveGameObject(UDOCSaveGame::StaticClass()));
	}
}

void UDOCEconomySubsystem::PersistSave() const
{
	if (SaveData)
	{
		UGameplayStatics::SaveGameToSlot(SaveData, SaveSlotName, 0);
	}
}

int32 UDOCEconomySubsystem::GetCredits() const
{
	return SaveData ? SaveData->Credits : 0;
}

int32 UDOCEconomySubsystem::GetUpgradeLevel(FName UpgradeId) const
{
	if (!SaveData)
	{
		return 0;
	}
	const int32* Level = SaveData->UpgradeLevels.Find(UpgradeId);
	return Level ? *Level : 0;
}

int32 UDOCEconomySubsystem::GetWeaponUpgradeLevel(EDOCWeaponType Weapon, EDOCWeaponUpgradeStat Stat) const
{
	if (!SaveData)
	{
		return 0;
	}
	const FDOCWeaponUpgradeLevels* Levels = SaveData->WeaponUpgradeLevels.Find(DOCEconomyRows::WeaponRowName(Weapon));
	if (!Levels)
	{
		return 0;
	}
	switch (Stat)
	{
	case EDOCWeaponUpgradeStat::Damage:
		return Levels->DamageLevel;
	case EDOCWeaponUpgradeStat::Stability:
		return Levels->StabilityLevel;
	case EDOCWeaponUpgradeStat::Reload:
		return Levels->ReloadLevel;
	default:
		return 0;
	}
}

int32 UDOCEconomySubsystem::GetUpgradeCostForLevel(FName UpgradeId, int32 Level) const
{
	if (!UpgradeDataTable)
	{
		return MAX_int32;
	}
	static const FString Context(TEXT("UDOCEconomySubsystem::GetUpgradeCostForLevel"));
	const FDOCUpgradeData* Row = UpgradeDataTable->FindRow<FDOCUpgradeData>(UpgradeId, Context);
	if (!Row || !Row->Costs.IsValidIndex(Level))
	{
		return MAX_int32;
	}
	return Row->Costs[Level];
}

int32 UDOCEconomySubsystem::GetWeaponUpgradeCostForLevel(int32 Level) const
{
	if (!WeaponUpgradeConfigTable)
	{
		return MAX_int32;
	}
	static const FString Context(TEXT("UDOCEconomySubsystem::GetWeaponUpgradeCostForLevel"));
	const FDOCWeaponUpgradeConfigData* Row = WeaponUpgradeConfigTable->FindRow<FDOCWeaponUpgradeConfigData>(TEXT("Default"), Context);
	if (!Row || !Row->Costs.IsValidIndex(Level))
	{
		return MAX_int32;
	}
	return Row->Costs[Level];
}

bool UDOCEconomySubsystem::TryPurchaseUpgrade(FName UpgradeId)
{
	if (!SaveData || !UpgradeDataTable)
	{
		return false;
	}

	static const FString Context(TEXT("UDOCEconomySubsystem::TryPurchaseUpgrade"));
	const FDOCUpgradeData* Row = UpgradeDataTable->FindRow<FDOCUpgradeData>(UpgradeId, Context);
	if (!Row)
	{
		return false;
	}

	const int32 CurrentLevel = GetUpgradeLevel(UpgradeId);
	if (CurrentLevel >= Row->MaxLevel)
	{
		return false;
	}

	const int32 Cost = GetUpgradeCostForLevel(UpgradeId, CurrentLevel);
	if (SaveData->Credits < Cost)
	{
		return false;
	}

	SaveData->Credits -= Cost;
	SaveData->UpgradeLevels.FindOrAdd(UpgradeId) = CurrentLevel + 1;
	PersistSave();
	return true;
}

bool UDOCEconomySubsystem::TryPurchaseWeaponUpgrade(EDOCWeaponType Weapon, EDOCWeaponUpgradeStat Stat)
{
	if (!SaveData || !WeaponUpgradeConfigTable)
	{
		return false;
	}

	static const FString Context(TEXT("UDOCEconomySubsystem::TryPurchaseWeaponUpgrade"));
	const FDOCWeaponUpgradeConfigData* ConfigRow = WeaponUpgradeConfigTable->FindRow<FDOCWeaponUpgradeConfigData>(TEXT("Default"), Context);
	if (!ConfigRow)
	{
		return false;
	}

	const int32 CurrentLevel = GetWeaponUpgradeLevel(Weapon, Stat);
	if (CurrentLevel >= ConfigRow->MaxLevel)
	{
		return false;
	}

	const int32 Cost = GetWeaponUpgradeCostForLevel(CurrentLevel);
	if (SaveData->Credits < Cost)
	{
		return false;
	}

	SaveData->Credits -= Cost;
	FDOCWeaponUpgradeLevels& Levels = SaveData->WeaponUpgradeLevels.FindOrAdd(DOCEconomyRows::WeaponRowName(Weapon));
	switch (Stat)
	{
	case EDOCWeaponUpgradeStat::Damage:
		Levels.DamageLevel = CurrentLevel + 1;
		break;
	case EDOCWeaponUpgradeStat::Stability:
		Levels.StabilityLevel = CurrentLevel + 1;
		break;
	case EDOCWeaponUpgradeStat::Reload:
		Levels.ReloadLevel = CurrentLevel + 1;
		break;
	}
	PersistSave();
	return true;
}

float UDOCEconomySubsystem::GetDifficultyCreditMult(EDOCDifficulty Difficulty) const
{
	if (!DifficultyDataTable)
	{
		return 1.f;
	}
	static const FString Context(TEXT("UDOCEconomySubsystem::GetDifficultyCreditMult"));
	if (const FDOCDifficultyData* Row = DifficultyDataTable->FindRow<FDOCDifficultyData>(DOCEconomyRows::DifficultyRowName(Difficulty), Context))
	{
		return Row->CreditMult;
	}
	return 1.f;
}

int32 UDOCEconomySubsystem::ApplyRunEndCredits(bool bWon, int32 CreditsBeforeDifficultyMult, int32 WaveReached, bool bEndless)
{
	if (!SaveData)
	{
		return 0;
	}

	const float CreditMult = GetDifficultyCreditMult(SaveData->Difficulty);
	const int32 FinalCredits = FMath::FloorToInt(CreditsBeforeDifficultyMult * CreditMult);

	SaveData->Credits += FinalCredits;
	SaveData->TotalCredits += FinalCredits;
	SaveData->TotalGames += 1;
	SaveData->TotalWins += bWon ? 1 : 0;
	SaveData->TotalDeaths += bWon ? 0 : 1;

	if (bEndless)
	{
		SaveData->BestEndlessWave = FMath::Max(SaveData->BestEndlessWave, WaveReached);
	}
	else
	{
		SaveData->BestWave = FMath::Max(SaveData->BestWave, WaveReached);
	}

	PersistSave();
	return FinalCredits;
}

void UDOCEconomySubsystem::ApplyUpgradesToCharacter(ADOCCharacter* Character) const
{
	if (!Character || !SaveData)
	{
		return;
	}

	Character->ApplyArmorPlatingLevel(GetUpgradeLevel(TEXT("ArmorPlating")));

	if (UDOCWeaponComponent* Weapon = Character->WeaponComponent)
	{
		const int32 AmmoReserveLevel = GetUpgradeLevel(TEXT("AmmoReserve"));
		Weapon->SetBaseReserveAmmo(120 + AmmoReserveLevel * 20);

		const int32 QuickReloadLevel = GetUpgradeLevel(TEXT("QuickReload"));
		Weapon->GlobalReloadTimeMult = 1.f - QuickReloadLevel * 0.05f;

		for (EDOCWeaponType Type : { EDOCWeaponType::Pistol, EDOCWeaponType::Rifle, EDOCWeaponType::Shotgun, EDOCWeaponType::Sniper })
		{
			Weapon->SetWeaponUpgradeLevels(
				Type,
				GetWeaponUpgradeLevel(Type, EDOCWeaponUpgradeStat::Damage),
				GetWeaponUpgradeLevel(Type, EDOCWeaponUpgradeStat::Stability),
				GetWeaponUpgradeLevel(Type, EDOCWeaponUpgradeStat::Reload));
		}
	}
}

float UDOCEconomySubsystem::GetPickupDropChance() const
{
	return 0.35f + GetUpgradeLevel(TEXT("Scavenger")) * 0.05f;
}

EDOCDifficulty UDOCEconomySubsystem::GetDifficulty() const
{
	return SaveData ? SaveData->Difficulty : EDOCDifficulty::Normal;
}

void UDOCEconomySubsystem::SetDifficulty(EDOCDifficulty NewDifficulty)
{
	if (!SaveData)
	{
		return;
	}
	SaveData->Difficulty = NewDifficulty;
	PersistSave();
}
