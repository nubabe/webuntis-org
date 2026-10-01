{
  description = "Fetch a WebUntis timetable into an org-mode file";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        webuntis-org = pkgs.callPackage ./package.nix { };
      in
      {
        packages.default = webuntis-org;

        apps.default = {
          type = "app";
          program = "${webuntis-org}/bin/webuntis-org";
        };

        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs
            pkgs.emacs
          ];
        };
      }
    )
    // {
      homeManagerModules.default = import ./home-manager-module.nix;
    };
}
