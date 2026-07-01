// NOTE: written without compiling against Unreal Engine 5.5 - see the note
// in ProtocolDOC.Target.cs, the same caveat applies here.

using UnrealBuildTool;
using System.Collections.Generic;

public class ProtocolDOCEditorTarget : TargetRules
{
	public ProtocolDOCEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;

		ExtraModuleNames.AddRange(new string[] { "ProtocolDOC" });
	}
}
