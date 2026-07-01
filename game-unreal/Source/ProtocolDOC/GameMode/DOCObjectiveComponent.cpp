// NOTE: written without compiling against Unreal Engine 5.5 - see
// /EDITOR_TODO.md.

#include "DOCObjectiveComponent.h"
#include "Data/DOCWaveObjectiveData.h"
#include "Engine/DataTable.h"
#include "Kismet/GameplayStatics.h"

UDOCObjectiveComponent::UDOCObjectiveComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

const FDOCWaveObjectiveData* UDOCObjectiveComponent::FindObjectiveRow(int32 WaveNumber, bool bEndless) const
{
	if (!WaveObjectiveTable)
	{
		return nullptr;
	}
	static const FString Context(TEXT("UDOCObjectiveComponent::FindObjectiveRow"));

	// Endless keeps campaign pacing for waves 1-5; only wave>=6 switches to
	// the open rotation - matches objectives.ts::getWaveObjective.
	if (bEndless && WaveNumber >= 6)
	{
		FName RowName;
		if (WaveNumber % 5 == 0)
		{
			RowName = TEXT("Endless_Boss");
		}
		else
		{
			switch (WaveNumber % 3)
			{
			case 1:
				RowName = TEXT("Endless_Mod1");
				break;
			case 2:
				RowName = TEXT("Endless_Mod2");
				break;
			default:
				RowName = TEXT("Endless_Mod0");
				break;
			}
		}
		return WaveObjectiveTable->FindRow<FDOCWaveObjectiveData>(RowName, Context);
	}

	const FName RowName(*FString::Printf(TEXT("Wave_%d"), FMath::Clamp(WaveNumber, 1, 6)));
	return WaveObjectiveTable->FindRow<FDOCWaveObjectiveData>(RowName, Context);
}

void UDOCObjectiveComponent::StartObjectiveForWave(int32 WaveNumber, bool bEndless)
{
	const FDOCWaveObjectiveData* Row = FindObjectiveRow(WaveNumber, bEndless);
	if (!Row)
	{
		return;
	}

	Runtime = FDOCObjectiveRuntimeState();
	Runtime.Kind = Row->Kind;
	Runtime.Label = Row->Label;
	Runtime.ZoneTag = Row->ZoneTag;
	Runtime.TimerSeconds = Row->DurationMs / 1000.f;
	Runtime.TimeLimitSeconds = Row->TimeLimitMs / 1000.f;
	Runtime.KillTarget = Row->KillThreshold;
	Runtime.CoreMaxHp = Row->CoreMaxHp;
	Runtime.CoreHp = Row->CoreMaxHp;
	// Extract only starts its countdown once the kill threshold is met and
	// the zone opens - matches objectives.ts::createRuntime's
	// `extractActive: !isExtract`.
	Runtime.bExtractActive = (Row->Kind != EDOCObjectiveKind::Extract);
	Runtime.Status = EDOCObjectiveStatus::Active;
}

AActor* UDOCObjectiveComponent::FindZoneActor() const
{
	if (Runtime.ZoneTag.IsNone())
	{
		return nullptr;
	}
	TArray<AActor*> Found;
	UGameplayStatics::GetAllActorsWithTag(GetWorld(), Runtime.ZoneTag, Found);
	return Found.Num() > 0 ? Found[0] : nullptr;
}

bool UDOCObjectiveComponent::IsPlayerInZone() const
{
	AActor* Zone = FindZoneActor();
	APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
	if (!Zone || !PlayerPawn)
	{
		return false;
	}
	return FVector::Dist(Zone->GetActorLocation(), PlayerPawn->GetActorLocation()) <= ObjectiveZoneRadius;
}

void UDOCObjectiveComponent::TickObjective(float DeltaSeconds)
{
	if (Runtime.Status != EDOCObjectiveStatus::Active)
	{
		return;
	}

	switch (Runtime.Kind)
	{
	case EDOCObjectiveKind::Eliminate:
		// Resolved externally via NotifyAllEnemiesCleared() - nothing to
		// tick here.
		break;

	case EDOCObjectiveKind::Hack:
		// Simplification: the countdown only progresses while the player is
		// standing in the zone. This is a reasonable reading of "Hack Node"
		// but wasn't re-derived line-by-line from GameApp.tsx's render loop
		// for this pass - double check against the web build once both are
		// side by side (EDITOR_TODO.md).
		Runtime.bInZone = IsPlayerInZone();
		if (Runtime.bInZone)
		{
			Runtime.TimerSeconds = FMath::Max(0.f, Runtime.TimerSeconds - DeltaSeconds);
			if (Runtime.TimerSeconds <= 0.f)
			{
				Resolve(true);
			}
		}
		break;

	case EDOCObjectiveKind::Defend:
		// Simplification: survive the timer as long as the core has HP.
		// Core damage isn't wired to enemy attacks yet - call
		// ApplyCoreDamage() once enemies can target the core actor
		// (EDITOR_TODO.md).
		Runtime.TimerSeconds = FMath::Max(0.f, Runtime.TimerSeconds - DeltaSeconds);
		if (Runtime.CoreHp <= 0.f)
		{
			Resolve(false);
		}
		else if (Runtime.TimerSeconds <= 0.f)
		{
			Resolve(true);
		}
		break;

	case EDOCObjectiveKind::Extract:
		if (!Runtime.bExtractActive)
		{
			if (Runtime.KillCount >= Runtime.KillTarget)
			{
				Runtime.bExtractActive = true;
				Runtime.TimerSeconds = Runtime.TimeLimitSeconds;
			}
			break;
		}
		Runtime.TimerSeconds = FMath::Max(0.f, Runtime.TimerSeconds - DeltaSeconds);
		Runtime.bInZone = IsPlayerInZone();
		if (Runtime.bInZone)
		{
			Resolve(true);
		}
		else if (Runtime.TimerSeconds <= 0.f)
		{
			Resolve(false);
		}
		break;
	}
}

void UDOCObjectiveComponent::NotifyEnemyKilled()
{
	if (Runtime.Status != EDOCObjectiveStatus::Active)
	{
		return;
	}
	++Runtime.KillCount;
}

void UDOCObjectiveComponent::NotifyAllEnemiesCleared()
{
	if (Runtime.Kind == EDOCObjectiveKind::Eliminate && Runtime.Status == EDOCObjectiveStatus::Active)
	{
		Resolve(true);
	}
}

void UDOCObjectiveComponent::ApplyCoreDamage(float Damage)
{
	Runtime.CoreHp = FMath::Max(0.f, Runtime.CoreHp - Damage);
}

void UDOCObjectiveComponent::Resolve(bool bSucceeded)
{
	Runtime.Status = bSucceeded ? EDOCObjectiveStatus::Complete : EDOCObjectiveStatus::Failed;
	OnObjectiveResolved.Broadcast(bSucceeded);
}
