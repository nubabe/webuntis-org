# A home-manager module running webuntis-org on a systemd user timer.
#
# Usage (flake-based home-manager config):
#
#   {
#     imports = [ inputs.webuntis-org.homeManagerModules.default ];
#     services.webuntis-org = {
#       enable = true;
#       environmentFile = "/run/secrets/webuntis-env"; # agenix/sops-nix, or a plain chmod-600 file
#       orgFileLink = "${config.home.homeDirectory}/org/school.org";
#     };
#   }
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.webuntis-org;

  # home.file keys are paths relative to $HOME; our options take absolute paths for clarity.
  homeRelative = path: lib.removePrefix "${config.home.homeDirectory}/" path;
in
{
  options.services.webuntis-org = {
    enable = lib.mkEnableOption "the WebUntis timetable fetcher";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      defaultText = lib.literalExpression "pkgs.callPackage ./package.nix { }";
      description = "The webuntis-org package to run.";
    };

    configDir = lib.mkOption {
      type = lib.types.str;
      default = "${config.xdg.configHome}/webuntis-org";
      description = ''
        Where `rules.json` lives — the one file you actually hand-edit.
        Copy it from this repo's `data/rules.json.example` and adjust it
        to your own subjects. Must be under your home directory.
      '';
    };

    stateDir = lib.mkOption {
      type = lib.types.str;
      default = "${config.xdg.stateHome}/webuntis-org";
      description = ''
        Where everything machine-managed lives: the generated
        `data/timetable.org`, plus `data/overrides.json`,
        `data/org-ids.json`, and `data/timetable-snapshot.json` (all
        created automatically — nothing to set up here). Also doubles as
        the systemd service's `WorkingDirectory`. Must be under your home
        directory.
      '';
    };

    orgFileLink = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        If set, a symlink is created at this path pointing at the
        generated `data/timetable.org` under `stateDir` — e.g. so you can
        add it to `org-agenda-files` at a conventional location while the
        real file stays under XDG state. Must be under your home directory.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Path to a file OUTSIDE the Nix store (e.g. managed by agenix/sops-nix,
        or a plain file you've chmod 600'd yourself) defining
        WEBUNTIS_SCHOOL_NAME, WEBUNTIS_USERNAME, and WEBUNTIS_PASSWORD.
        Required — credentials must never be baked into a world-readable
        Nix store path.
      '';
    };

    onCalendar = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [
        "06:00"
        "10:00"
        "14:00"
        "18:00"
      ];
      description = "systemd OnCalendar expressions for how often to refetch.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.environmentFile != null;
        message = "services.webuntis-org.environmentFile must be set (WebUntis credentials).";
      }
    ];

    # The app always reads/writes fixed relative paths (data/rules.json, data/timetable.org,
    # ...) under its working directory. rules.json is config, not state, so it's symlinked in
    # from configDir; everything else genuinely is state and lives directly under stateDir —
    # no symlink needed, the app writes there itself.
    home.file = lib.mkMerge [
      {
        "${homeRelative cfg.stateDir}/data/rules.json".source =
          config.lib.file.mkOutOfStoreSymlink "${cfg.configDir}/rules.json";
      }
      (lib.mkIf (cfg.orgFileLink != null) {
        "${homeRelative cfg.orgFileLink}".source =
          config.lib.file.mkOutOfStoreSymlink "${cfg.stateDir}/data/timetable.org";
      })
    ];

    systemd.user.services.webuntis-org = {
      Unit = {
        Description = "Fetch WebUntis timetable and update timetable.org";
        After = [ "network-online.target" ];
        Wants = [ "network-online.target" ];
      };
      Service = {
        Type = "oneshot";
        WorkingDirectory = cfg.stateDir;
        EnvironmentFile = cfg.environmentFile;
        ExecStart = lib.getExe cfg.package;
      };
    };

    systemd.user.timers.webuntis-org = {
      Unit.Description = "Run webuntis-org on a schedule";
      Timer = {
        OnCalendar = cfg.onCalendar;
        Persistent = true;
      };
      Install.WantedBy = [ "timers.target" ];
    };
  };
}
