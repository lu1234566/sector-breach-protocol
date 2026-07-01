// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Credits/upgrades economy, ported from src/game-app/game/constants.ts
// (UPGRADES, WEAPON_UPGRADE_COSTS) and GameApp.tsx::endRun. See
// docs/scorestreaks.md #3-4.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Data/DOCTypes.h"
#include "DOCEconomySubsystem.generated.h"

class UDataTable;
class ADOCCharacter;
class UDOCSaveGame;

UCLASS()
class UDOCEconomySubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Economy")
	TObjectPtr<UDataTable> UpgradeDataTable;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Economy")
	TObjectPtr<UDataTable> WeaponUpgradeConfigTable;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Economy")
	TObjectPtr<UDataTable> DifficultyDataTable;

	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Economy")
	FString SaveSlotName = TEXT("ProtocolDOCSave");

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Economy")
	int32 GetCredits() const;

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Economy")
	int32 GetUpgradeLevel(FName UpgradeId) const;

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Economy")
	int32 GetWeaponUpgradeLevel(EDOCWeaponType Weapon, EDOCWeaponUpgradeStat Stat) const;

	// False if already at max level or not enough credits.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Economy")
	bool TryPurchaseUpgrade(FName UpgradeId);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Economy")
	bool TryPurchaseWeaponUpgrade(EDOCWeaponType Weapon, EDOCWeaponUpgradeStat Stat);

	// Applies the difficulty CreditMult, updates Credits/TotalCredits/
	// TotalGames/TotalWins/TotalDeaths/BestWave/BestEndlessWave, persists,
	// and returns the final credits earned - matches GameApp.tsx::endRun.
	// Bind to ADOCGameMode::OnRunEnded (CreditsBeforeDifficultyMult is that
	// delegate's second parameter).
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Economy")
	int32 ApplyRunEndCredits(bool bWon, int32 CreditsBeforeDifficultyMult, int32 WaveReached, bool bEndless);

	// Applies ArmorPlating (max HP), AmmoReserve (base reserve ammo),
	// QuickReload (global reload mult) and all per-weapon upgrade levels to
	// a freshly spawned character - call from the deploy flow before
	// gameplay starts.
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Economy")
	void ApplyUpgradesToCharacter(ADOCCharacter* Character) const;

	// baseDropChance (0.35) + Scavenger level * 0.05, matches
	// pickups.ts/combat.ts's drop-chance formula. Not yet wired to a pickup
	// actor - see EDITOR_TODO.md.
	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Economy")
	float GetPickupDropChance() const;

	UFUNCTION(BlueprintPure, Category = "Protocol DOC|Economy")
	EDOCDifficulty GetDifficulty() const;

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Economy")
	void SetDifficulty(EDOCDifficulty NewDifficulty);

private:
	void LoadOrCreateSave();
	void PersistSave() const;
	float GetDifficultyCreditMult(EDOCDifficulty Difficulty) const;
	int32 GetUpgradeCostForLevel(FName UpgradeId, int32 Level) const;
	int32 GetWeaponUpgradeCostForLevel(int32 Level) const;

	UPROPERTY()
	TObjectPtr<UDOCSaveGame> SaveData;
};
