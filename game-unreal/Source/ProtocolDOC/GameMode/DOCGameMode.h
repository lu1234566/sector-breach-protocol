// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.
//
// Orchestrates UDOCWaveManagerComponent + UDOCObjectiveComponent, matching
// the responsibilities split across GameApp.tsx (endRun, wave progression)
// and useWaveSystem.ts/objectives.ts in the web version. See
// docs/scorestreaks.md.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Data/DOCTypes.h"
#include "DOCGameMode.generated.h"

class UDOCWaveManagerComponent;
class UDOCObjectiveComponent;
class ADOCEnemyCharacter;

// CreditsBeforeDifficultyMult still needs UDOCEconomySubsystem to apply the
// difficulty CreditMult and persist it - see Economy/DOCEconomySubsystem.h.
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FDOCRunEndedSignature, bool, bWon, int32, CreditsBeforeDifficultyMult);

UCLASS()
class ADOCGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ADOCGameMode();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Protocol DOC")
	TObjectPtr<UDOCWaveManagerComponent> WaveManager;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Protocol DOC")
	TObjectPtr<UDOCObjectiveComponent> Objective;

	// FINAL_WAVE = 6 in constants.ts: campaign ends after Extract.
	UPROPERTY(EditAnywhere, Category = "Protocol DOC|Run")
	int32 FinalCampaignWave = 6;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Run")
	EDOCPlayMode PlayMode = EDOCPlayMode::Campaign;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Run")
	EDOCDifficulty Difficulty = EDOCDifficulty::Normal;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Run")
	int32 CurrentWave = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Run")
	int32 Score = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Protocol DOC|Run")
	int32 Kills = 0;

	UPROPERTY(BlueprintAssignable, Category = "Protocol DOC|Run")
	FDOCRunEndedSignature OnRunEnded;

	// Call from the Deploy Screen widget once it exists (EDITOR_TODO.md).
	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Run")
	void StartRun(EDOCPlayMode InPlayMode, EDOCDifficulty InDifficulty);

	UFUNCTION(BlueprintCallable, Category = "Protocol DOC|Run")
	void EndRun(bool bWon);

private:
	UFUNCTION()
	void HandleEnemyKilled(ADOCEnemyCharacter* DeadEnemy);

	UFUNCTION()
	void HandleAllEnemiesCleared();

	UFUNCTION()
	void HandleObjectiveResolved(bool bSucceeded);

	void StartWave(int32 WaveNumber);
	void AdvanceToNextWave();
	int32 ComputeFinalCredits(bool bWon) const;

	double RunStartTimeSeconds = 0.0;
	bool bRunEnding = false;
};
