// NOTE: written without compiling against Unreal Engine 5.5 - verify
// TargetRules API (BuildSettingsVersion, IncludeOrderVersion) still matches
// on first build; these enum members occasionally get renamed between
// engine versions.

using UnrealBuildTool;
using System.Collections.Generic;

public class ProtocolDOCTarget : TargetRules
{
	public ProtocolDOCTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;

		ExtraModuleNames.AddRange(new string[] { "ProtocolDOC" });
	}
}
