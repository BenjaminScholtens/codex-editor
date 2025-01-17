import * as vscode from "vscode";
import { analyzeEditHistory } from "../../activationHelpers/contextAware/miniIndex/indexes/editHistory";

export class EditAnalysisProvider implements vscode.Disposable {
    public static readonly viewType = "codex-editor.editAnalysis";
    private _panel?: vscode.WebviewPanel;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    dispose() {
        this._panel?.dispose();
        this._panel = undefined;
    }

    public async show() {
        if (this._panel) {
            this._panel.reveal();
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            EditAnalysisProvider.viewType,
            "Edit Analysis",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });

        await this.updateContent();
    }

    private async updateContent() {
        if (!this._panel) {
            return;
        }

        const analysis = await analyzeEditHistory();

        // Create data points for the graph
        const dataPoints = analysis.rawDistances.map((d) => ({
            x: d.sequenceNumber,
            y: d.distance,
            llmText: d.llmText,
            userText: d.userText,
        }));

        // Calculate dimensions and scales
        const width = 1200;
        const height = 600;
        const padding = 60;
        const maxY = Math.max(...dataPoints.map((d) => d.y));
        const maxX = Math.max(...dataPoints.map((d) => d.x));

        // Create points for the line graph
        const points = dataPoints
            .map((d) => {
                const x = (d.x / maxX) * (width - 2 * padding) + padding;
                const y = height - ((d.y / maxY) * (height - 2 * padding) + padding);
                return `${x},${y}`;
            })
            .join(" ");

        // Calculate trend
        let trend = "No clear trend detected";
        if (analysis.timeSnapshots.length >= 3) {
            const [first, second, third] = analysis.timeSnapshots;
            if (
                first.averageDistance > second.averageDistance &&
                second.averageDistance > third.averageDistance
            ) {
                trend =
                    "📉 Edit distances are decreasing - LLM is successfully learning from user corrections";
            } else if (
                first.averageDistance < second.averageDistance &&
                second.averageDistance < third.averageDistance
            ) {
                trend =
                    "📈 Edit distances are increasing - LLM may need additional training or adjustment";
            }
        }

        this._panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Edit Distance Analysis</title>
            <style>
                body {
                    padding: 20px;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: system-ui;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 20px;
                    border-radius: 8px;
                }
                .stat-card {
                    padding: 15px;
                    border-radius: 6px;
                    background: var(--vscode-editor-background);
                }
                .stat-label {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 5px;
                }
                .stat-value {
                    font-size: 1.5em;
                    font-weight: bold;
                }
                .graph-container {
                    margin-top: 30px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-editor-foreground);
                    border-radius: 8px;
                    padding: 20px;
                }
                .graph {
                    width: 100%;
                    height: auto;
                }
                .axis-label {
                    fill: var(--vscode-editor-foreground);
                    font-family: system-ui;
                    font-size: 12px;
                }
                .graph-line {
                    stroke: var(--vscode-charts-blue);
                    stroke-width: 2;
                    fill: none;
                }
                .graph-point {
                    fill: var(--vscode-charts-blue);
                    r: 4;
                    transition: r 0.2s, fill 0.2s;
                    cursor: pointer;
                }
                .graph-point:hover {
                    r: 6;
                    fill: var(--vscode-charts-orange);
                }
                .axis {
                    stroke: var(--vscode-editor-foreground);
                    stroke-width: 1;
                }
                .title {
                    font-size: 24px;
                    margin-bottom: 1em;
                    color: var(--vscode-editor-foreground);
                }
                .trend {
                    font-size: 1.1em;
                    margin: 20px 0;
                    padding: 15px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 6px;
                }
                .tooltip {
                    position: absolute;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-editor-foreground);
                    padding: 10px;
                    border-radius: 4px;
                    display: none;
                    pointer-events: none;
                    z-index: 1000;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 class="title">Edit Distance Analysis</h1>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-label">Total Edits</div>
                        <div class="stat-value">${analysis.editDistances.length}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Edit Distance</div>
                        <div class="stat-value">${analysis.averageEditDistance.toFixed(2)}</div>
                    </div>
                    ${analysis.timeSnapshots
                        .map(
                            (snapshot, i) => `
                        <div class="stat-card">
                            <div class="stat-label">Phase ${i + 1} Average</div>
                            <div class="stat-value">${snapshot.averageDistance.toFixed(2)}</div>
                        </div>
                    `
                        )
                        .join("")}
                </div>

                <div class="trend">${trend}</div>

                <div class="graph-container">
                    <div id="tooltip" class="tooltip"></div>
                    <svg class="graph" viewBox="0 0 ${width} ${height}">
                        <!-- Y-axis -->
                        <line class="axis" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"/>
                        <!-- X-axis -->
                        <line class="axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"/>
                        
                        <!-- Axis labels -->
                        <text class="axis-label" x="${width / 2}" y="${height - 10}" text-anchor="middle">Edit Sequence</text>
                        <text class="axis-label" x="15" y="${height / 2}" text-anchor="middle" transform="rotate(-90, 15, ${height / 2})">Edit Distance</text>
                        
                        <!-- Data points and line -->
                        <polyline class="graph-line" points="${points}"/>
                        ${dataPoints
                            .map((d) => {
                                const x = (d.x / maxX) * (width - 2 * padding) + padding;
                                const y =
                                    height - ((d.y / maxY) * (height - 2 * padding) + padding);
                                return `<circle class="graph-point" 
                                    cx="${x}" cy="${y}" 
                                    data-sequence="${d.x}" 
                                    data-distance="${d.y}"
                                    data-llm="${d.llmText.replace(/"/g, "&quot;")}"
                                    data-user="${d.userText.replace(/"/g, "&quot;")}"
                                />`;
                            })
                            .join("\n")}
                    </svg>
                </div>

                <details style="margin-top: 30px;">
                    <summary style="cursor: pointer; padding: 10px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px;">
                        <h2 style="display: inline-block; margin: 0;">Raw Edit Data</h2>
                    </summary>
                    <pre style="background: var(--vscode-editor-inactiveSelectionBackground); padding: 15px; border-radius: 6px; overflow: auto; margin-top: 10px;">
${dataPoints
    .map(
        (d) => `Edit #${d.x}:
• Distance: ${d.y}
• LLM Text: "${d.llmText}"
• User Edit: "${d.userText}"
`
    )
    .join("\n")}
                    </pre>
                </details>
            </div>
            <script>
                const tooltip = document.getElementById('tooltip');
                const points = document.querySelectorAll('.graph-point');
                
                points.forEach(point => {
                    point.addEventListener('mouseover', (e) => {
                        const seq = e.target.dataset.sequence;
                        const dist = e.target.dataset.distance;
                        const llm = e.target.dataset.llm;
                        const user = e.target.dataset.user;
                        
                        tooltip.innerHTML = \`
                            <strong>Edit #\${seq}</strong><br>
                            Distance: \${dist}<br>
                            LLM: \${llm}<br>
                            User: \${user}
                        \`;
                        tooltip.style.display = 'block';
                        tooltip.style.left = (e.pageX + 10) + 'px';
                        tooltip.style.top = (e.pageY + 10) + 'px';
                    });
                    
                    point.addEventListener('mouseout', () => {
                        tooltip.style.display = 'none';
                    });
                    
                    point.addEventListener('mousemove', (e) => {
                        tooltip.style.left = (e.pageX + 10) + 'px';
                        tooltip.style.top = (e.pageY + 10) + 'px';
                    });
                });
            </script>
        </body>
        </html>`;
    }
}

export function createEditAnalysisProvider(extensionUri: vscode.Uri): EditAnalysisProvider {
    return new EditAnalysisProvider(extensionUri);
}
