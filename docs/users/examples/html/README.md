# HTML Output Samples

These files demonstrate the `card-view` HTML template from the `document` command, rendered with different markdown engines.

To regenerate:

```bash
mcpcontract document --template card-view sample-mcpdesc.yaml -o html-marked
mcpcontract document --template card-view --markdown-engine markdown-it sample-mcpdesc.yaml -o html-markdown-it
mcpcontract document --template card-view --markdown-engine snarkdown sample-mcpdesc.yaml -o html-snarkdown
```

The three outputs differ only in how markdown inside tool/prompt descriptions is rendered (e.g., link handling, list formatting).
