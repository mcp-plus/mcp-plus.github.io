/* =============================================================================
   CHARTS (Pipeline + Bar Chart) — MCP+ blog
   Loaded after D3 + Observable Plot. Requires #bar-chart and #flow-c in DOM.
   ============================================================================= */

(function () {
    "use strict";

    var barEl = document.getElementById("bar-chart");
    var flowEl = document.getElementById("flow-c");
    if (!barEl || !flowEl || typeof Plot === "undefined") return;

    /* Use a fixed layout size; SVGs will be made responsive and stretch to container width */
    var layoutWidth = 960;

    /* All costs in dollars per task (same scale) so all bars are visible. Replace with real data when ready. */
    var scatterData = [
        { domain: "Playwright", model: "Claude 4.0 Sonnet", perfStd: 29.9, perfMcp: 30.7, costStd: 0.48, costMcp: 0.09 },
        { domain: "Playwright", model: "GPT-5", perfStd: 43.6, perfMcp: 38.5, costStd: 0.42, costMcp: 0.08 },
        { domain: "Playwright", model: "Gemini-3-Pro", perfStd: 78, perfMcp: 78, costStd: 0.38, costMcp: 0.07 },
        { domain: "YFinance", model: "Claude 4.0 Sonnet", perfStd: 92, perfMcp: 92, costStd: 0.25, costMcp: 0.04 },
        { domain: "YFinance", model: "GPT-5", perfStd: 88, perfMcp: 88, costStd: 0.22, costMcp: 0.035 },
        { domain: "YFinance", model: "Gemini-3-Pro", perfStd: 85, perfMcp: 85, costStd: 0.18, costMcp: 0.03 },
        { domain: "Google Search", model: "Claude 4.0 Sonnet", perfStd: 70, perfMcp: 70, costStd: 0.15, costMcp: 0.03 },
        { domain: "Google Search", model: "GPT-5", perfStd: 68, perfMcp: 68, costStd: 0.12, costMcp: 0.025 },
        { domain: "Google Search", model: "Gemini-3-Pro", perfStd: 65, perfMcp: 65, costStd: 0.10, costMcp: 0.02 }
    ];

    var barData = scatterData.map(function (d) {
        return [
            { domain: d.domain, model: d.model, type: "MCP+ Cost", cost: d.costMcp },
            { domain: d.domain, model: d.model, type: "Extra Cost (Savings)", cost: d.costStd - d.costMcp }
        ];
    });
    barData = barData.reduce(function (a, b) { return a.concat(b); }, []);

    var barPlot = Plot.plot({
        width: layoutWidth,
        height: 320,
        marginLeft: 60,
        marginBottom: 80,
        marginRight: 20,
        marginTop: 30,
        x: { label: null, axis: "bottom", tickRotate: -30 },
        y: { label: "Cost per Task ($)", domain: [0, 0.55], tickFormat: function (d) { return "$" + d.toFixed(2); }, grid: true },
        fx: { label: null, padding: 0.2 },
        color: {
            domain: ["MCP+ Cost", "Extra Cost (Savings)"],
            range: ["#70bf75", "#a2372d"],
            legend: false
        },
        marks: [
            Plot.barY(barData, Plot.stackY({
                x: "model",
                y: "cost",
                fx: "domain",
                fill: "type",
                stroke: "#333333",
                strokeWidth: 1,
                order: ["MCP+ Cost", "Extra Cost (Savings)"],
                tip: true,
                title: function (d) {
                    return d.type + "\n" + d.model + "\nDomain: " + d.domain + "\nCost: $" + d.cost.toFixed(2);
                }
            })),
            Plot.ruleY([0])
        ],
        style: {
            background: "transparent",
            fontSize: "11px",
            fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        }
    });

    /* ========== FLOWCHART LAYOUT CONFIG ==========
     * All positions and sizes live here. Change one value to move/resize:
     * - rows.*     → vertical position (y) for: title, icon, iconLabel, arrowRequest, arrowRequestLabel, arrowResponse, haystack, haystackLabel, cost
     * - left.*     → left half: agentX, serverX, centerX, arrowInset (larger = shorter arrows), arrowRequestLabelX
     * - right.*    → right half: same + arrowInset (larger = shorter arrows), arrowRequestLabelX, box, arrowStrokes
     * - labels.*   → font size (px) for: title, icon, arrow, arrowSmall, haystack, cost, boxTitle
     * - iconSizes  → agent, server, mcpplus, overflow (each in px; set independently for proportion)
     * - chart      → height, xDomain, yDomain, dividerX
     */
    var FLOW_CONFIG = {
        chart: {
            height: 260,
            xDomain: [0, 20],
            yDomain: [2, 8],
            dividerX: 10
        },
        rows: {
            title: 7.7,
            icon: 5.4,
            iconLabel: 4.0,
            arrowRequest: 5.8,
            arrowRequestLabel: 6.0,
            arrowResponse: 4.7,
            haystack: 4.7,
            haystackLabel: 3.9,
            cost: 2.4
        },
        labels: {
            title: 15,
            icon: 12,
            arrow: 9,
            arrowSmall: 8,
            haystack: 12,
            cost: 12,
            boxTitle: 12
        },
        left: {
            centerX: 4.75,
            agentX: 1.5,
            serverX: 7.5,
            arrowInset: 1.5,
            arrowRequestLabelX: 4.75
        },
        right: {
            centerX: 15.25,
            agentX: 12.0,
            mcpplusX: 15.6,
            serverX: 18.6,
            arrowInset: 1.0,
            arrowRequestLabelX: 13.8,
            box: { x1: 14.8, x2: 19.8, y1: 3.7, y2: 7.0 },
            arrowStrokes: { request: 1.2, requestSub: 1, responseRed: 2, responseGreen: 1.2 }
        },
        iconSizes: {
            agent: 100,
            server: 75,
            mcpplus: 45,
            overflow: 34
        }
    };

    var c = FLOW_CONFIG;
    var r = c.rows;
    var L = c.left;
    var R = c.right;
    var sz = c.iconSizes;
    var lbl = c.labels;

    var flowIconData = [
        { x: L.agentX, y: r.icon, src: "assets/icons/pastel_red_robot.png", w: sz.agent, h: sz.agent },
        { x: L.serverX, y: r.icon, src: "assets/icons/server.png", w: sz.server, h: sz.server },
        { x: R.agentX, y: r.icon, src: "assets/icons/pastel_red_robot.png", w: sz.agent, h: sz.agent },
        { x: R.mcpplusX, y: r.icon, src: "assets/icons/blue_mcp_plus_bot_nobg.png", w: sz.mcpplus, h: sz.mcpplus },
        { x: R.serverX, y: r.icon, src: "assets/icons/server.png", w: sz.server, h: sz.server }
    ];
    var overflowIconData = [
        { x: L.centerX, y: r.haystack, src: "assets/icons/overflow.png", w: sz.overflow, h: sz.overflow },
        { x: (R.serverX + R.mcpplusX) / 2, y: r.haystack, src: "assets/icons/overflow.png", w: sz.overflow, h: sz.overflow }
    ];

    var flowC = Plot.plot({
        width: layoutWidth,
        height: c.chart.height,
        axis: null,
        x: { domain: c.chart.xDomain },
        y: { domain: c.chart.yDomain },
        marks: [
            Plot.ruleX([c.chart.dividerX], { stroke: "#e2e8f0", strokeWidth: 1 }),
            Plot.text([{ x: L.centerX, y: r.title, label: "❌ Without MCP+" }], {
                x: "x", y: "y", text: "label", fill: "#64748b", fontWeight: "bold", fontSize: lbl.title
            }),
            Plot.text([{ x: R.centerX, y: r.title, label: "✅ With MCP+" }], {
                x: "x", y: "y", text: "label", fill: "#64748b", fontWeight: "bold", fontSize: lbl.title
            }),
            Plot.rect([{ x1: R.box.x1, x2: R.box.x2, y1: R.box.y1, y2: R.box.y2 }], {
                x1: "x1", x2: "x2", y1: "y1", y2: "y2",
                fill: "#fafafa", stroke: "#e2e8f0", strokeWidth: 1, rx: 8
            }),
            Plot.text([{ x: R.box.x1 + (R.box.x2 - R.box.x1) / 2, y: R.box.y2 - 0.35, label: "MCP Enhanced" }], {
                x: "x", y: "y", text: "label", fill: "#64748b", fontWeight: "bold", fontSize: lbl.boxTitle, textAnchor: "middle"
            }),
            Plot.image(flowIconData, { x: "x", y: "y", src: "src", width: "w", height: "h" }),
            Plot.text([{ x: L.agentX, y: r.iconLabel, label: "Agent" }], {
                x: "x", y: "y", text: "label", fill: "#b60654ff", fontWeight: "bold", fontSize: lbl.icon, textAnchor: "middle"
            }),
            Plot.text([{ x: L.serverX, y: r.iconLabel, label: "Server" }], {
                x: "x", y: "y", text: "label", fill: "#085cab", fontWeight: "bold", fontSize: lbl.icon, textAnchor: "middle"
            }),
            Plot.link([{ x1: L.agentX + L.arrowInset, y1: r.arrowRequest, x2: L.serverX - L.arrowInset, y2: r.arrowRequest }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#1a3232", strokeWidth: 2, markerEnd: "arrow"
            }),
            Plot.text([{ x: L.arrowRequestLabelX, y: r.arrowRequestLabel, label: "Tool Call Arguments" }], {
                x: "x", y: "y", text: "label", fill: "#1a3232", fontSize: lbl.arrow, fontWeight: "bold", textAnchor: "middle"
            }),
            Plot.link([{ x1: L.serverX - L.arrowInset, y1: r.arrowResponse, x2: L.agentX + L.arrowInset, y2: r.arrowResponse }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#a2372d", strokeWidth: 6, markerEnd: "arrow"
            }),
            Plot.text([{ x: L.centerX, y: r.haystackLabel, label: "Haystack" }], {
                x: "x", y: "y", text: "label", fill: "#a2372d", fontWeight: "bold", fontSize: lbl.haystack, textAnchor: "middle"
            }),
            Plot.text([{ x: L.centerX, y: r.cost, label: "😰 High cost" }], {
                x: "x", y: "y", text: "label", fill: "#a2372d", fontSize: lbl.cost, textAnchor: "middle"
            }),
            Plot.text([{ x: R.agentX, y: r.iconLabel, label: "Agent" }], {
                x: "x", y: "y", text: "label", fill: "#b60654ff", fontWeight: "bold", fontSize: lbl.icon, textAnchor: "middle"
            }),
            Plot.text([{ x: R.mcpplusX, y: r.iconLabel, label: "MCP+" }], {
                x: "x", y: "y", text: "label", fill: "#0b827cff", fontWeight: "bold", fontSize: lbl.icon, textAnchor: "middle"
            }),
            Plot.text([{ x: R.serverX, y: r.iconLabel, label: "Server" }], {
                x: "x", y: "y", text: "label", fill: "#085cab", fontWeight: "bold", fontSize: lbl.icon, textAnchor: "middle"
            }),
            Plot.link([{ x1: R.agentX + R.arrowInset, y1: r.arrowRequest, x2: R.mcpplusX - R.arrowInset, y2: r.arrowRequest }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#1a3232", strokeWidth: R.arrowStrokes.request, markerEnd: "arrow"
            }),
            Plot.text([{ x: R.arrowRequestLabelX, y: r.arrowRequestLabel, label: "Args + expected_info" }], {
                x: "x", y: "y", text: "label", fill: "#1a3232", fontSize: lbl.arrowSmall, fontWeight: "bold", textAnchor: "middle"
            }),
            Plot.link([{ x1: R.mcpplusX + R.arrowInset, y1: r.arrowRequest, x2: R.serverX - R.arrowInset, y2: r.arrowRequest }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#1a3232", strokeWidth: R.arrowStrokes.requestSub, markerEnd: "arrow"
            }),
            Plot.link([{ x1: R.serverX - R.arrowInset, y1: r.arrowResponse, x2: R.mcpplusX + R.arrowInset, y2: r.arrowResponse }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#a2372d", strokeWidth: R.arrowStrokes.responseRed, markerEnd: "arrow"
            }),
            Plot.link([{ x1: R.mcpplusX - R.arrowInset, y1: r.arrowResponse, x2: R.agentX + R.arrowInset, y2: r.arrowResponse }], {
                x1: "x1", y1: "y1", x2: "x2", y2: "y2",
                stroke: "#1c3326", strokeWidth: R.arrowStrokes.responseGreen, markerEnd: "arrow"
            }),
            Plot.text([{ x: (R.agentX + R.mcpplusX) / 2, y: r.arrowResponse - 0.3, label: "📍 Needle" }], {
                x: "x", y: "y", text: "label", fill: "#1c3326", fontSize: lbl.haystack, fontWeight: "bold", textAnchor: "middle"
            }),
            Plot.text([{ x: R.centerX, y: r.cost, label: "😎 Upto 80% cost savings" }], {
                x: "x", y: "y", text: "label", fill: "#2d5a30", fontSize: lbl.cost, textAnchor: "middle"
            }),
            Plot.image([
                { x: R.mcpplusX, y: r.icon, src: "assets/icons/blue_mcp_plus_bot_nobg.png", w: sz.mcpplus, h: sz.mcpplus },
                { x: R.serverX, y: r.icon, src: "assets/icons/server.png", w: sz.server, h: sz.server }
            ], { x: "x", y: "y", src: "src", width: "w", height: "h" }),
            Plot.image(overflowIconData, { x: "x", y: "y", src: "src", width: "w", height: "h" })
        ],
        style: {
            background: "transparent",
            fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        }
    });

    barEl.appendChild(barPlot);
    flowEl.appendChild(flowC);

    /* Make SVGs responsive: stretch to 100% of container width (same as surrounding text) */
    function makeSvgResponsive(el) {
        var svg = el && el.tagName === "svg" ? el : (el && el.querySelector ? el.querySelector("svg") : null);
        if (!svg) return;
        if (!svg.hasAttribute("viewBox") && svg.getAttribute("width") && svg.getAttribute("height")) {
            svg.setAttribute("viewBox", "0 0 " + svg.getAttribute("width") + " " + svg.getAttribute("height"));
        }
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "auto");
        svg.style.maxWidth = "100%";
    }
    makeSvgResponsive(barPlot);
    makeSvgResponsive(flowC);

})();
