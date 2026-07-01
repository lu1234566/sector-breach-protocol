// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md. Row struct for the Difficulties DataTable
// (Data/CSV/Difficulties.csv -> DT_Difficulties). Values ported 1:1 from
// src/game-app/game/constants.ts (DIFFICULTIES), see
// docs/sistemas-a-portar.md and docs/bots-ia.md #1.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "DOCTypes.h"
#include "DOCDifficultyData.generated.h"

USTRUCT(BlueprintType)
struct FDOCDifficultyData : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
	EDOCDifficulty Difficulty = EDOCDifficulty::Normal;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
	float HPMult = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
	float DamageMult = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
	float CreditMult = 1.f;
};
