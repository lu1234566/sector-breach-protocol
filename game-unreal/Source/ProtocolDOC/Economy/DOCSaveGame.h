// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Persistence, ported from src/game-app/game/persistence.ts. The web
// version uses individual localStorage keys (nano_credits, nano_upgrades,
// nano_weapon_upgrades, nano_stats, nano_difficulty, protocol_arena); this
// consolidates them into a single USaveGame object, which is the idiomatic
// Unreal equivalent.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Data/DOCTypes.h"
#include "DOCSaveGame.generated.h"

USTRUCT(BlueprintType)
struct FDOCWeaponUpgradeLevels
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite)
	int32 DamageLevel = 0;

	UPROPERTY(BlueprintReadWrite)
	int32 StabilityLevel = 0;

	UPROPERTY(BlueprintReadWrite)
	int32 ReloadLevel = 0;
};

UCLASS()
class UDOCSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 Credits = 0;

	// Keys: "ArmorPlating", "AmmoReserve", "QuickReload", "Scavenger" (see
	// Data/CSV/Upgrades.csv row names). Missing key == level 0.
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	TMap<FName, int32> UpgradeLevels;

	// Keys: "Pistol", "Rifle", "Shotgun", "Sniper" (DT_Weapons row names).
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	TMap<FName, FDOCWeaponUpgradeLevels> WeaponUpgradeLevels;

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	EDOCDifficulty Difficulty = EDOCDifficulty::Normal;

	// Matches persistence.ts's protocol_arena key - last arena the player
	// selected on the Deploy Screen. "None" until a level-select UI exists.
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	FName LastArenaId = NAME_None;

	// --- LifetimeStats (types.ts) ---

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 TotalKills = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 TotalDeaths = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 TotalCredits = 0;

	// Campaign best (1-6).
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 BestWave = 0;

	// Endless survival record.
	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 BestEndlessWave = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 TotalWins = 0;

	UPROPERTY(BlueprintReadWrite, Category = "Protocol DOC|Save")
	int32 TotalGames = 0;
};
