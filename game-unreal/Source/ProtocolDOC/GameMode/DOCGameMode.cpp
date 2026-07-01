// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCGameMode.h"
#include "DOCWaveManagerComponent.h"
#include "DOCObjectiveComponent.h"
#include "AI/DOCEnemyCharacter.h"
#include "Player/DOCCharacter.h"
#include "Kismet/GameplayStatics.h"

ADOCGameMode::ADOCGameMode()
{
	PrimaryActorTick.bCanEverTick = true;

	WaveManager = CreateDefaultSubobject<UDOCWaveManagerComponent>(TEXT("WaveManager"));
	Objective = CreateDefaultSubobject<UDOCObjectiveComponent>(TEXT("Objective"));
}

void ADOCGameMode::BeginPlay()
{
	Super::BeginPlay();

	WaveManager->OnEnemyKilled.AddDynamic(this, &ADOCGameMode::HandleEnemyKilled);
	WaveManager->OnAllEnemiesCleared.AddDynamic(this, &ADOCGameMode::HandleAllEnemiesCleared);
	Objective->OnObjectiveResolved.AddDynamic(this, &ADOCGameMode::HandleObjectiveResolved);

	// TODO (Editor phase): trigger StartRun() from the Deploy Screen widget
	// instead of leaving it uncalled - see EDITOR_TODO.md (HUD/menu
	// widgets), mirrors the web version's deploy -> playing transition.
}

void ADOCGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bRunEnding || CurrentWave <= 0)
	{
		return;
	}

	Objective->TickObjective(DeltaSeconds);

	// ADOCCharacter has no death delegate yet - polling CurrentHP here is a
	// stopgap; wiring an explicit OnPlayerDied delegate on the character is
	// cleaner future work (EDITOR_TODO.md / docs/GDD.md).
	if (ADOCCharacter* PlayerCharacter = Cast<ADOCCharacter>(UGameplayStatics::GetPlayerPawn(GetWorld(), 0)))
	{
		if (PlayerCharacter->CurrentHP <= 0.f)
		{
			EndRun(false);
		}
	}
}

void ADOCGameMode::StartRun(EDOCPlayMode InPlayMode, EDOCDifficulty InDifficulty)
{
	PlayMode = InPlayMode;
	Difficulty = InDifficulty;
	Score = 0;
	Kills = 0;
	CurrentWave = 0;
	bRunEnding = false;
	RunStartTimeSeconds = FPlatformTime::Seconds();

	StartWave(1);
}

void ADOCGameMode::StartWave(int32 WaveNumber)
{
	CurrentWave = WaveNumber;
	Objective->StartObjectiveForWave(WaveNumber, PlayMode == EDOCPlayMode::Endless);
	WaveManager->StartWave(WaveNumber, Difficulty, RunStartTimeSeconds);
}

void ADOCGameMode::HandleEnemyKilled(ADOCEnemyCharacter* DeadEnemy)
{
	if (!DeadEnemy || bRunEnding)
	{
		return;
	}

	++Kills;
	Score += DeadEnemy->GetKillScoreValue();
	Objective->NotifyEnemyKilled();

	// Credits, pickup drop chance (Scavenger upgrade) and killfeed text are
	// UDOCEconomySubsystem's job - see docs/scorestreaks.md #3 and
	// Economy/DOCEconomySubsystem.h. Kept out of GameMode to avoid
	// duplicating the upgrade-lookup logic that already lives there.
}

void ADOCGameMode::HandleAllEnemiesCleared()
{
	Objective->NotifyAllEnemiesCleared();
}

void ADOCGameMode::HandleObjectiveResolved(bool bSucceeded)
{
	if (bRunEnding)
	{
		return;
	}

	if (!bSucceeded)
	{
		EndRun(false);
		return;
	}

	if (PlayMode == EDOCPlayMode::Campaign && CurrentWave >= FinalCampaignWave)
	{
		EndRun(true);
		return;
	}

	AdvanceToNextWave();
}

void ADOCGameMode::AdvanceToNextWave()
{
	StartWave(CurrentWave + 1);
}

int32 ADOCGameMode::ComputeFinalCredits(bool bWon) const
{
	// Matches GameApp.tsx::endRun exactly (see docs/scorestreaks.md #3),
	// EXCEPT the difficulty CreditMult - that lookup belongs to
	// UDOCEconomySubsystem, which owns DT_Difficulties and applies it before
	// persisting the result.
	return bWon
		? FMath::FloorToInt(Kills * 15.f + CurrentWave * 100.f + Score / 5.f + 1500.f)
		: FMath::FloorToInt(Kills * 10.f + CurrentWave * 50.f + Score / 10.f);
}

void ADOCGameMode::EndRun(bool bWon)
{
	if (bRunEnding)
	{
		return;
	}
	bRunEnding = true;

	const int32 CreditsBeforeDifficultyMult = ComputeFinalCredits(bWon);
	OnRunEnded.Broadcast(bWon, CreditsBeforeDifficultyMult);
}
