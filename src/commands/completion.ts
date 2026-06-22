// Copyright 2026 Cisco Systems, Inc. and its affiliates
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Completion command - Generate shell completion scripts
 */

import { Command } from 'commander';

export function completionCommand(): Command {
  const cmd = new Command('completion');

  cmd
    .description('Generate shell completion script')
    .argument('[shell]', 'Shell type: bash, zsh, or fish (auto-detected if not specified)')
    .action((shell?: string) => {
      const detectedShell = shell || detectShell();
      
      if (!detectedShell) {
        console.error('Could not detect shell. Please specify: bash, zsh, or fish');
        console.error('Example: mcpcontract completion bash >> ~/.bashrc');
        process.exit(1);
      }

      const script = generateCompletionScript(detectedShell);
      console.log(script);
      
      if (!shell) {
        // Show installation instructions
        console.error('');
        console.error(`# To enable completion, add this to your shell config:`);
        if (detectedShell === 'bash') {
          console.error(`# echo 'eval "$(mcpcontract completion bash)"' >> ~/.bashrc`);
          console.error(`#`);
          console.error(`# Then reload your shell:`);
          console.error(`# source ~/.bashrc`);
          console.error(`# (or start a new terminal)`);
        } else if (detectedShell === 'zsh') {
          console.error(`# echo 'eval "$(mcpcontract completion zsh)"' >> ~/.zshrc`);
          console.error(`#`);
          console.error(`# Then reload your shell:`);
          console.error(`# source ~/.zshrc`);
          console.error(`# (or start a new terminal)`);
        } else if (detectedShell === 'fish') {
          console.error(`# mcpcontract completion fish > ~/.config/fish/completions/mcpcontract.fish`);
          console.error(`#`);
          console.error(`# Fish will auto-load completions in new sessions`);
        }
      }
    });

  return cmd;
}

/**
 * Detect current shell
 */
function detectShell(): string | null {
  const shell = process.env.SHELL || '';
  
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('fish')) return 'fish';
  
  return null;
}

/**
 * Generate completion script for the specified shell
 */
function generateCompletionScript(shell: string): string {
  if (shell === 'bash') {
    return `# mcpcontract completion for bash
_mcpcontract_completion() {
    local cur prev words cword
    
    # Try to use bash-completion's _init_completion if available
    if declare -F _init_completion >/dev/null 2>&1; then
        _init_completion
    else
        # Fallback for systems without bash-completion
        cur="\${COMP_WORDS[COMP_CWORD]}"
        prev="\${COMP_WORDS[COMP_CWORD-1]}"
        words=("\${COMP_WORDS[@]}")
        cword=\${COMP_CWORD}
    fi

    # Commands
    local commands="dump split convert manifest validate document diff breaking changelog completion rules agents"
    
    # If no command yet, complete commands
    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
        return
    fi

    local cmd=\${words[1]}
    
    # Handle enum value completion based on previous option
    case "\${prev}" in
        --transport|-t)
            COMPREPLY=( $(compgen -W "streamable-http sse stdio" -- "\${cur}") )
            return
            ;;
        --to-format)
            COMPREPLY=( $(compgen -W "dump mcpdesc" -- "\${cur}") )
            return
            ;;
        --format|-f)
            case "\${cmd}" in
                dump)
                    COMPREPLY=( $(compgen -W "json yaml markdown" -- "\${cur}") )
                    ;;
                manifest)
                    COMPREPLY=( $(compgen -W "json yaml" -- "\${cur}") )
                    ;;
                validate)
                    COMPREPLY=( $(compgen -W "text json" -- "\${cur}") )
                    ;;
                changelog)
                    COMPREPLY=( $(compgen -W "json yaml markdown" -- "\${cur}") )
                    ;;
                *)
                    COMPREPLY=( $(compgen -W "json yaml" -- "\${cur}") )
                    ;;
            esac
            return
            ;;
        --schema)
            COMPREPLY=( $(compgen -W "mcpdesc mcp-description dump manifest manifest-info diff diff-breaking dump-split" -- "\${cur}") )
            return
            ;;
        --type)
            COMPREPLY=( $(compgen -W "manifest mcpdesc dump auto" -- "\${cur}") )
            return
            ;;
        --category)
            COMPREPLY=( $(compgen -W "tools prompts resources resourceTemplates serverInfo" -- "\${cur}") )
            return
            ;;
        --severity)
            COMPREPLY=( $(compgen -W "info major critical" -- "\${cur}") )
            return
            ;;
        --display)
            COMPREPLY=( $(compgen -W "short full" -- "\${cur}") )
            return
            ;;
        --template|-t)
            case "\${cmd}" in
                document)
                    COMPREPLY=( $(compgen -W "manifest-documentation manifest-reference mcpdesc-documentation reference-documentation card-view registry-submission" -- "\${cur}") )
                    ;;
                *)
                    compopt -o default
                    COMPREPLY=()
                    ;;
            esac
            return
            ;;
        --rendering|-r)
            COMPREPLY=( $(compgen -W "full reference" -- "\${cur}") )
            return
            ;;
        --markdown-engine)
            COMPREPLY=( $(compgen -W "marked markdown-it snarkdown" -- "\${cur}") )
            return
            ;;
    esac
    
    # Handle different cases based on current word
    case "\${cmd}" in
        rules)
            # Special handling for rules subcommands
            if [[ \${cword} -eq 2 ]]; then
                # Complete subcommands at position 2
                local subcommands="list list-catalogs show examples validate export"
                COMPREPLY=( $(compgen -W "\${subcommands}" -- "\${cur}") )
                return
            elif [[ \${cword} -gt 2 ]]; then
                # We have a subcommand, handle its options
                local subcmd=\${words[2]}
                if [[ "\${cur}" == --* ]]; then
                    # Show long options for subcommand
                    case "\${subcmd}" in
                        list)
                            local opts="--category --severity --breaking --rules --catalog --format --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        list-catalogs)
                            local opts="--help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        show)
                            local opts="--rules --catalog --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        examples)
                            local opts="--rules --catalog --variant --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        validate)
                            local opts="--rules --catalog --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        export)
                            local opts="--rules --catalog --format --output --summary --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                    esac
                elif [[ "\${cur}" == -* ]]; then
                    # Show short options
                    local opts="-h"
                    COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                else
                    # Show options without dash prefix
                    case "\${subcmd}" in
                        list)
                            local opts="--category --severity --breaking --rules --catalog --format --help"
                            COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                            ;;
                        show|examples)
                            # Use default completion for rule names
                            compopt -o default
                            COMPREPLY=()
                            ;;
                        *)
                            compopt -o default
                            COMPREPLY=()
                            ;;
                    esac
                fi
            fi
            ;;
        agents)
            # Special handling for agents command
            if [[ "\${prev}" == "--command" ]]; then
                local subcommands="dump split convert manifest validate diff breaking changelog document rules completion"
                COMPREPLY=( $(compgen -W "\${subcommands}" -- "\${cur}") )
            elif [[ "\${cur}" == -* ]]; then
                local opts="--command --workflows --all"
                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
            else
                # Show options even without dash prefix
                local opts="--command --workflows --all"
                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
            fi
            ;;
        *)
            # Standard command handling
            if [[ "\${cur}" == --* ]]; then
                # User typed --, show long options
                case "\${cmd}" in
                    dump)
                        local opts="--wizard --config --mcp-server --server-name --transport --url --header --command --args --env --output --format --compact --quiet --verbose --info --skip-cors-check --cors-origin --page-size --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    split)
                        local opts="--config --output-dir --format --pretty --no-pretty --dry-run --validate --quiet --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    convert)
                        local opts="--to-format --output --format --compact --quiet --guide --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    manifest)
                        local opts="--mcpdesc --info --output --format --pretty --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    validate)
                        local opts="--schema --strict --format --output --show-compatibility --display --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    document)
                        local opts="--template --rendering --output --type --list --show-extraction-details --markdown-engine --quiet --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    diff)
                        local opts="--from --to --output --detect-renames --quiet --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    breaking)
                        local opts="--diff --rules --output --quiet --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    changelog)
                        local opts="--diff --breaking --output --format --template --quiet --help"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    completion)
                        # Completion command takes shell type as argument
                        local shells="bash zsh fish"
                        COMPREPLY=( $(compgen -W "\${shells}" -- "\${cur}") )
                        ;;
                esac
            elif [[ "\${cur}" == -* ]]; then
                # User typed -, show short options
                case "\${cmd}" in
                    dump)
                        local opts="-w -c -s -n -t -u -H -o -f -i -q -v -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    split)
                        local opts="-h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    convert)
                        local opts="-o -f -q -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    manifest)
                        local opts="-d -i -o -f -p -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    validate)
                        local opts="-f -o -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    document)
                        local opts="-t -r -o -q -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    diff)
                        local opts="-o -q -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    breaking)
                        local opts="-o -q -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    changelog)
                        local opts="-o -f -t -q -h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                    completion)
                        local opts="-h"
                        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                        ;;
                esac
            else
                # No dash prefix - provide file completion or other context-specific completions
                case "\${cmd}" in
                    split|convert|document|validate)
                        # These commands take file arguments - use file completion
                        compopt -o default
                        COMPREPLY=()
                        ;;
                    completion)
                        # Completion command takes shell type as argument
                        local shells="bash zsh fish"
                        COMPREPLY=( $(compgen -W "\${shells}" -- "\${cur}") )
                        ;;
                    *)
                        # Other commands show options to improve discoverability
                        case "\${cmd}" in
                            dump)
                                local opts=\"--config --mcp-server --server-name --transport --url --header --command --args --env --output --format --pretty --quiet --info --skip-cors-check --cors-origin --page-size --help\"
                                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                                ;;
                            manifest)
                                local opts="--mcpdesc --info --output --format --pretty --help"
                                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                                ;;
                            diff)
                                local opts="--from --to --output --detect-renames --quiet --help"
                                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                                ;;
                            breaking)
                                local opts="--diff --rules --output --quiet --help"
                                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                                ;;
                            changelog)
                                local opts="--diff --breaking --output --format --template --quiet --help"
                                COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
                                ;;
                            *)
                                # Use standard completion (files/directories)
                                compopt -o default
                                COMPREPLY=()
                                ;;
                        esac
                        ;;
                esac
            fi
            ;;
    esac
}

complete -F _mcpcontract_completion mcpcontract
`;
  } else if (shell === 'zsh') {
    return `# mcpcontract completion for zsh
#compdef mcpcontract

_mcp_contract() {
    local -a commands
    commands=(
        'dump:Extract capabilities from a live MCP server'
        'split:Split large MCP description into focused subsets'
        'convert:Convert between dump and mcpdesc formats'
        'manifest:Generate server.json from MCP description and metadata'
        'validate:Validate files against MCP schemas'
        'document:Generate human-readable documentation'
        'diff:Compare manifests and detect changes'
        'breaking:Analyze breaking changes'
        'changelog:Generate changelog between versions'
        'completion:Generate shell completion script'
        'rules:Browse and explore rules catalog'
        'agents:Agent-optimized help (for Copilot, Claude, etc.)'
    )

    local curcontext="\$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '1: :->command' \\
        '*:: :->args'

    case \$state in
        command)
            _describe 'command' commands
            ;;
        args)
            case \$line[1] in
                dump)
                    _arguments \\
                        '(-w --wizard)'{-w,--wizard}'[Launch interactive wizard]' \\
                        '(-c --config)'{-c,--config}'[Path to config file]:file:_files' \\
                        '(-s --mcp-server)'{-s,--mcp-server}'[Select server]:server:' \\
                        '(-n --server-name)'{-n,--server-name}'[Server name]:name:' \\
                        '(-t --transport)'{-t,--transport}'[Transport type]:type:(streamable-http sse stdio)' \\
                        '(-u --url)'{-u,--url}'[Server URL]:url:' \\
                        '*'{-H,--header}'[HTTP header (repeatable)]:header:' \\
                        '--command[Command to execute]:command:_command_names' \\
                        '--args[Command arguments]:args:' \\
                        '--env[Environment variables]:env:' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '(-f --format)'{-f,--format}'[Output format]:format:(json yaml markdown)' \\
                        '--compact[Compact JSON output]' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress messages]' \\
                        '(-v --verbose)'{-v,--verbose}'[Verbose output]' \\
                        '--skip-cors-check[Skip CORS detection]' \\
                        '--cors-origin[CORS preflight origin]:origin:' \\
                        '--page-size[Page size for pagination testing]:number:' \\
                        '(-i --info)'{-i,--info}'[Enrichment info file]:file:_files' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                split)
                    _arguments \\
                        '1:MCP description file:_files' \\
                        '--config[Split configuration file]:file:_files' \\
                        '--output-dir[Output directory]:directory:_files -/' \\
                        '(-f --format)'{-f,--format}'[Output format]:format:(json yaml)' \\
                        '--pretty[Pretty print JSON]' \\
                        '--no-pretty[Compact JSON output]' \\
                        '--dry-run[Preview without writing files]' \\
                        '--validate[Validate output dumps]' \\
                        '--quiet[Suppress messages]' \\
                        '(-h --help)'{-h,--help}'[Show help]'
                    ;;
                convert)
                    _arguments \\
                        '1:Input file:_files' \\
                        '--to-format[Target format]:format:(dump mcpdesc)' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '(-f --format)'{-f,--format}'[Serialization format]:format:(json yaml)' \\
                        '--compact[Compact JSON output]' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress messages]' \\
                        '--guide[Print conversion guide for AI assistants]' \\
                        '(-h --help)'{-h,--help}'[Show help]'
                    ;;
                manifest)
                    _arguments \\
                        '(-d --mcpdesc)'{-d,--mcpdesc}'[MCP description file]:file:_files' \\
                        '(-i --info)'{-i,--info}'[Info file]:file:_files' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '(-f --format)'{-f,--format}'[Output format]:format:(json yaml)' \\
                        '(-p --pretty)'{-p,--pretty}'[Pretty print]' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                validate)
                    _arguments \\
                        '1:file:_files' \\
                        '--schema[Schema type]:type:(mcpdesc mcp-description dump manifest manifest-info diff diff-breaking dump-split)' \\
                        '--strict[Treat warnings as errors]' \\
                        '(-f --format)'{-f,--format}'[Output format]:format:(text json)' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '--show-compatibility[Display schema-CLI compatibility matrix]' \\
                        '--display[Display mode]:mode:(short full)' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                document)
                    _arguments \\
                        '1:file:_files' \\
                        '(-t --template)'{-t,--template}'[Template name]:template:(manifest-documentation manifest-reference mcpdesc-documentation reference-documentation card-view registry-submission)' \\
                        '(-r --rendering)'{-r,--rendering}'[Rendering mode]:mode:(full reference)' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '--type[Input type]:type:(manifest mcpdesc dump auto)' \\
                        '--list[List templates]' \\
                        '--show-extraction-details[Show session, CORS, and extraction info]' \\
                        '--markdown-engine[Markdown engine for HTML templates]:engine:(marked markdown-it snarkdown)' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress messages]' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                diff)
                    _arguments \\
                        '--from[Source MCP description/manifest]:file:_files' \\
                        '--to[Target MCP description/manifest]:file:_files' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '--detect-renames[Detect renames]' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress output]' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                breaking)
                    _arguments \\
                        '--diff[Diff file]:file:_files' \\
                        '--rules[Rules file]:file:_files' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress output]' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                changelog)
                    _arguments \\
                        '--diff[Structural diff file]:file:_files' \\
                        '--breaking[Breaking change analysis]:file:_files' \\
                        '(-o --output)'{-o,--output}'[Output file]:file:_files' \\
                        '(-f --format)'{-f,--format}'[Output format]:format:(json yaml markdown)' \\
                        '(-t --template)'{-t,--template}'[Template file]:file:_files' \\
                        '(-q --quiet)'{-q,--quiet}'[Suppress output]' \\
                        '(-h --help)'{-h,--help}'[Show help]' \\
                        '*:file:_files'
                    ;;
                completion)
                    _arguments \\
                        '1:shell:(bash zsh fish)' \\
                        '(-h --help)'{-h,--help}'[Show help]'
                    ;;
                rules)
                    local -a subcommands
                    subcommands=(
                        'list:List all rules in the catalog'
                        'list-catalogs:Discover available catalogs'
                        'show:Show detailed documentation for a rule'
                        'examples:Show pass/fail examples for a rule'
                        'validate:Validate catalog completeness'
                        'export:Export catalog as JSON or Markdown'
                    )
                    _arguments \\
                        '1: :->subcommand' \\
                        '*:: :->args'
                    case $state in
                        subcommand)
                            _describe 'subcommand' subcommands
                            ;;
                        args)
                            case $line[1] in
                                list)
                                    _arguments \\
                                        '--category[Filter by category]:category:(tools prompts resources resourceTemplates serverInfo)' \\
                                        '--severity[Filter by severity]:severity:(info major critical)' \\
                                        '--breaking[Show only breaking rules]' \\
                                        '--rules[Custom rules file]:file:_files' \\
                                        '--catalog[Custom catalog directory]:directory:_directories' \\
                                        '--format[Output format]:format:(table json)' \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                                list-catalogs)
                                    _arguments \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                                show)
                                    _arguments \\
                                        '1:rule:' \\
                                        '--rules[Custom rules file]:file:_files' \\
                                        '--catalog[Custom catalog directory]:directory:_directories' \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                                examples)
                                    _arguments \\
                                        '1:rule:' \\
                                        '--rules[Custom rules file]:file:_files' \\
                                        '--catalog[Custom catalog directory]:directory:_directories' \\
                                        '--variant[Show specific variant]:variant:' \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                                validate)
                                    _arguments \\
                                        '--rules[Custom rules file]:file:_files' \\
                                        '--catalog[Custom catalog directory]:directory:_directories' \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                                export)
                                    _arguments \\
                                        '--rules[Custom rules file]:file:_files' \\
                                        '--catalog[Custom catalog directory]:directory:_directories' \\
                                        '--format[Output format]:format:(json markdown)' \\
                                        '--output[Output file]:file:_files' \\
                                        '--summary[Export summary without examples]' \\
                                        '(-h --help)'{-h,--help}'[Show help]'
                                    ;;
                            esac
                            ;;
                    esac
                    ;;
                agents)
                    _arguments \
                        '--command[Get help for specific command]:command:(dump manifest validate diff breaking changelog document rules completion)' \
                        '--workflows[Show all end-to-end workflows]' \
                        '--all[Output all commands in single document]'
                    ;;
                *)
                    _files
                    ;;
            esac
            ;;
    esac
}

_mcp_contract
`;
  } else if (shell === 'fish') {
    return `# mcpcontract completion for fish

# Commands
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "dump" -d "Extract capabilities from a live MCP server"
complete -c mcpcontract -n "__fish_use_subcommand" -a "split" -d "Split large MCP description into focused subsets"
complete -c mcpcontract -n "__fish_use_subcommand" -a "convert" -d "Convert between dump and mcpdesc formats"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "manifest" -d "Generate server.json from MCP description and metadata"
complete -c mcpcontract -n "__fish_use_subcommand" -a "validate" -d "Validate files against MCP schemas"
complete -c mcpcontract -n "__fish_use_subcommand" -a "document" -d "Generate human-readable documentation"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "diff" -d "Compare manifests and detect changes"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "breaking" -d "Analyze breaking changes"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "changelog" -d "Generate changelog between versions"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "completion" -d "Generate shell completion script"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "rules" -d "Browse and explore rules catalog"
complete -c mcpcontract -f -n "__fish_use_subcommand" -a "agents" -d "Agent-optimized help (for Copilot, Claude, etc.)"

# dump command options
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s w -l wizard -d "Launch interactive wizard"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s c -l config -d "Path to config file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s s -l mcp-server -d "Select server"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s n -l server-name -d "Server name"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s t -l transport -d "Transport type" -a "streamable-http sse stdio"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s u -l url -d "Server URL"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s H -l headers -d "HTTP headers"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l command -d "Command to execute"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l args -d "Command arguments"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l env -d "Environment variables"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s f -l format -d "Output format" -a "json yaml markdown"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l compact -d "Compact JSON output"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s q -l quiet -d "Suppress messages"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s v -l verbose -d "Verbose output"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l skip-cors-check -d "Skip CORS detection"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l cors-origin -d "CORS preflight origin"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -l page-size -d "Page size for pagination testing"
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s i -l info -d "Enrichment info file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from dump" -s h -l help -d "Show help"

# split command options
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l config -d "Split configuration file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l output-dir -d "Output directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -s f -l format -d "Output format" -a "json yaml"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l pretty -d "Pretty print JSON"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l no-pretty -d "Compact JSON output"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l dry-run -d "Preview without writing files"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l validate -d "Validate output dumps"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -l quiet -d "Suppress messages"
complete -c mcpcontract -n "__fish_seen_subcommand_from split" -s h -l help -d "Show help"

# convert command options
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -l to-format -d "Target format" -a "dump mcpdesc"
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -s f -l format -d "Serialization format" -a "json yaml"
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -l compact -d "Compact JSON output"
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -s q -l quiet -d "Suppress messages"
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -l guide -d "Print conversion guide for AI assistants"
complete -c mcpcontract -n "__fish_seen_subcommand_from convert" -s h -l help -d "Show help"

# manifest command options
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s d -l mcpdesc -d "MCP description file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s i -l info -d "Info file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s f -l format -d "Output format" -a "json yaml"
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s p -l pretty -d "Pretty print"
complete -c mcpcontract -n "__fish_seen_subcommand_from manifest" -s h -l help -d "Show help"

# validate command options
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -l schema -d "Schema type" -a "mcpdesc dump manifest manifest-info diff diff-breaking dump-split"
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -l strict -d "Treat warnings as errors"
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -s f -l format -d "Output format" -a "text json"
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -l show-compatibility -d "Display schema-CLI compatibility matrix"
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -l display -d "Display mode" -a "short full"
complete -c mcpcontract -n "__fish_seen_subcommand_from validate" -s h -l help -d "Show help"

# document command options
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -s t -l template -d "Template name" -a "manifest-documentation manifest-reference mcpdesc-documentation reference-documentation card-view registry-submission"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -s r -l rendering -d "Rendering mode" -a "full reference"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -l type -d "Input type" -a "manifest mcpdesc dump auto"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -l list -d "List templates"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -l show-extraction-details -d "Show session, CORS, and extraction info"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -l markdown-engine -d "Markdown engine for HTML templates" -a "marked markdown-it snarkdown"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -s q -l quiet -d "Suppress messages"
complete -c mcpcontract -n "__fish_seen_subcommand_from document" -s h -l help -d "Show help"

# diff command options
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -l from -d "Source MCP description/manifest" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -l to -d "Target MCP description/manifest" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -l detect-renames -d "Detect renames"
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -s q -l quiet -d "Suppress output"
complete -c mcpcontract -n "__fish_seen_subcommand_from diff" -s h -l help -d "Show help"

# breaking command options
complete -c mcpcontract -n "__fish_seen_subcommand_from breaking" -l diff -d "Diff file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from breaking" -l rules -d "Rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from breaking" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from breaking" -s q -l quiet -d "Suppress output"
complete -c mcpcontract -n "__fish_seen_subcommand_from breaking" -s h -l help -d "Show help"

# changelog command options
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -l diff -d "Structural diff file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -l breaking -d "Breaking change analysis" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -s o -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -s f -l format -d "Output format" -a "json yaml markdown"
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -s t -l template -d "Template file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -s q -l quiet -d "Suppress output"
complete -c mcpcontract -n "__fish_seen_subcommand_from changelog" -s h -l help -d "Show help"

# completion command
complete -c mcpcontract -n "__fish_seen_subcommand_from completion" -a "bash zsh fish" -d "Shell type"
complete -c mcpcontract -n "__fish_seen_subcommand_from completion" -s h -l help -d "Show help"

# rules command subcommands
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "list" -d "List all rules in the catalog"
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "list-catalogs" -d "Discover available catalogs"
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "show" -d "Show detailed documentation for a rule"
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "examples" -d "Show pass/fail examples for a rule"
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "validate" -d "Validate catalog completeness"
complete -c mcpcontract -f -n "__fish_seen_subcommand_from rules" -a "export" -d "Export catalog as JSON or Markdown"

# rules list options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l category -d "Filter by category" -a "tools prompts resources resourceTemplates serverInfo"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l severity -d "Filter by severity" -a "info major critical"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l breaking -d "Show only breaking rules"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l rules -d "Custom rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l catalog -d "Custom catalog directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -l format -d "Output format" -a "table json"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list" -s h -l help -d "Show help"

# rules list-catalogs options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from list-catalogs" -s h -l help -d "Show help"

# rules show options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from show" -l rules -d "Custom rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from show" -l catalog -d "Custom catalog directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from show" -s h -l help -d "Show help"

# rules examples options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from examples" -l rules -d "Custom rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from examples" -l catalog -d "Custom catalog directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from examples" -l variant -d "Show specific variant"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from examples" -s h -l help -d "Show help"

# rules validate options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from validate" -l rules -d "Custom rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from validate" -l catalog -d "Custom catalog directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from validate" -s h -l help -d "Show help"

# rules export options
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l rules -d "Custom rules file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l catalog -d "Custom catalog directory" -a "(__fish_complete_directories)"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l format -d "Output format" -a "json markdown"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l output -d "Output file" -F
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l summary -d "Export summary without examples"
complete -c mcpcontract -n "__fish_seen_subcommand_from rules; and __fish_seen_subcommand_from export" -l summary -d "Export summary without examples"

# agents command options
complete -c mcpcontract -n "__fish_seen_subcommand_from agents" -l command -d "Get help for specific command" -a "dump split convert manifest validate diff breaking changelog document rules completion"
complete -c mcpcontract -n "__fish_seen_subcommand_from agents" -l workflows -d "Show all end-to-end workflows"
complete -c mcpcontract -n "__fish_seen_subcommand_from agents" -l all -d "Output all commands in single document"
`;
  }

  return '';
}
