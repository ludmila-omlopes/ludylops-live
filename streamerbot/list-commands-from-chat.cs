using System;

public class CPHInline
{
    private static readonly string[] ModeratorArgCandidates = new[]
    {
        "isModerator",
        "isMod",
        "userIsModerator",
    };

    private static readonly string[] BroadcasterArgCandidates = new[]
    {
        "isBroadcaster",
        "isStreamer",
        "userIsBroadcaster",
    };

    private static readonly string[] AdminArgCandidates = new[]
    {
        "isAdmin",
        "userIsAdmin",
    };

    private const string DefaultPublicLineOne =
        "Comandos: !link CODIGO | !pontos / !saldo / !pipetz / !points | !quote [numero] | !quoteobs <numero>";

    private const string DefaultPublicLineTwo =
        "Mais: !bet <opcao> <valor> | !deaths";

    private const string DefaultModeratorLine =
        "Mods: !death+ [n] | !death- [n] | !addquote <texto>";

    public bool Execute()
    {
        bool useBotAccount = ReadOptionalBoolGlobal("lojaneon.useBotAccount", false);
        bool isModerator = GetFirstBoolArg(ModeratorArgCandidates, false);
        bool isBroadcaster = GetFirstBoolArg(BroadcasterArgCandidates, false);
        bool isAdmin = GetFirstBoolArg(AdminArgCandidates, false);
        bool showModeratorCommands = isModerator || isBroadcaster || isAdmin;

        string publicLineOne = ReadOptionalGlobal("lojaneon.commandsListPublic1");
        string publicLineTwo = ReadOptionalGlobal("lojaneon.commandsListPublic2");
        string moderatorLine = ReadOptionalGlobal("lojaneon.commandsListMod");

        if (string.IsNullOrWhiteSpace(publicLineOne))
        {
            publicLineOne = DefaultPublicLineOne;
        }

        if (string.IsNullOrWhiteSpace(publicLineTwo))
        {
            publicLineTwo = DefaultPublicLineTwo;
        }

        if (string.IsNullOrWhiteSpace(moderatorLine))
        {
            moderatorLine = DefaultModeratorLine;
        }

        Reply(publicLineOne, useBotAccount);

        if (!string.IsNullOrWhiteSpace(publicLineTwo))
        {
            Reply(publicLineTwo, useBotAccount);
        }

        if (showModeratorCommands && !string.IsNullOrWhiteSpace(moderatorLine))
        {
            Reply(moderatorLine, useBotAccount);
        }

        return true;
    }

    private void Reply(string message, bool useBot)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        CPH.SendYouTubeMessageToLatestMonitored(message.Trim(), useBot, true);
    }

    private string ReadOptionalGlobal(string variableName)
    {
        try
        {
            return CPH.GetGlobalVar<string>(variableName, true) ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    private bool ReadOptionalBoolGlobal(string variableName, bool defaultValue)
    {
        try
        {
            return CPH.GetGlobalVar<bool>(variableName, true);
        }
        catch
        {
            return defaultValue;
        }
    }

    private bool GetFirstBoolArg(string[] argNames, bool defaultValue)
    {
        if (argNames == null)
        {
            return defaultValue;
        }

        foreach (string argName in argNames)
        {
            if (string.IsNullOrWhiteSpace(argName))
            {
                continue;
            }

            try
            {
                if (args != null && args.ContainsKey(argName) && args[argName] != null)
                {
                    object rawValue = args[argName];
                    if (rawValue is bool directBool)
                    {
                        return directBool;
                    }

                    string rawText = rawValue.ToString();
                    if (!string.IsNullOrWhiteSpace(rawText) && bool.TryParse(rawText.Trim(), out bool parsedBool))
                    {
                        return parsedBool;
                    }
                }
            }
            catch
            {
            }

            try
            {
                if (CPH.TryGetArg(argName, out bool typedValue))
                {
                    return typedValue;
                }
            }
            catch
            {
            }

            try
            {
                if (CPH.TryGetArg(argName, out string stringValue) &&
                    !string.IsNullOrWhiteSpace(stringValue) &&
                    bool.TryParse(stringValue.Trim(), out bool parsedValue))
                {
                    return parsedValue;
                }
            }
            catch
            {
            }
        }

        return defaultValue;
    }
}
