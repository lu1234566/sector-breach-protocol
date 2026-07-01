// NOTE: written without compiling against Unreal Engine 5.5 - this project has
// never been opened in the Editor. Module dependency names are believed
// correct for UE 5.5 but may need adjustment on first build (see
// EDITOR_TODO.md).

using UnrealBuildTool;

public class ProtocolDOC : ModuleRules
{
	public ProtocolDOC(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"AIModule",
			"NavigationSystem",
			"GameplayTasks",
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
		});

		// Uncomment if/when online save (rather than local SaveGame) is needed.
		// PrivateDependencyModuleNames.Add("OnlineSubsystem");
	}
}
