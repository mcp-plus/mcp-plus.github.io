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
        { domain: "Playwright", model: "Claude 4.0 Sonnet", perfStd: 29.9, perfMcp: 30.7, costStd: 93.17, costMcp: 47.5 },
        { domain: "Playwright", model: "GPT-5", perfStd: 43.6, perfMcp: 38.5, costStd: 43.8, costMcp: 11.4 },
        { domain: "Playwright", model: "Gemini-3-Pro", perfStd: 37.6, perfMcp: 0.0, costStd: 92.48, costMcp: 0.0 },
        { domain: "Yahoo Finance", model: "Claude 4.0 Sonnet", perfStd: 62.5, perfMcp: 66.7, costStd: 7.83, costMcp: 3.0 },
        { domain: "Yahoo Finance", model: "GPT-5", perfStd: 65.0, perfMcp: 70.8, costStd: 3.06, costMcp: 1.23 },
        { domain: "Yahoo Finance", model: "Gemini-3-Pro", perfStd: 62.5, perfMcp: 0.0, costStd: 5.93, costMcp: 0.0 },
        { domain: "Google Search", model: "Claude 4.0 Sonnet", perfStd: 17.8, perfMcp: 20.6, costStd: 88.72, costMcp: 47.84 },
        { domain: "Google Search", model: "GPT-5", perfStd: 41.8, perfMcp: 41.8, costStd: 23.46, costMcp: 15.7 },
        { domain: "Google Search", model: "Gemini-3-Pro", perfStd: 46.7, perfMcp: 0.0, costStd: 43.53, costMcp: 0.00 }
    ];

    var barData = scatterData.map(function (d) {
        var savings = d.costStd - d.costMcp;
        return [
            { domain: d.domain, model: d.model, type: "Input Cost with MCP+", cost: d.costMcp, costStd: d.costStd, costMcp: d.costMcp },
            { domain: d.domain, model: d.model, type: "Baseline Extra Cost (Savings)", cost: savings, costStd: d.costStd, costMcp: d.costMcp }
        ];
    });
    barData = barData.reduce(function (a, b) { return a.concat(b); }, []);

    /* Domains for faceting; each will get its own plot with independent y-scale */
    var domains = ["Playwright", "Yahoo Finance", "Google Search"];

    /* Model name -> logo: use "src" for local path, or "name" + "color" for Simple Icons CDN */
    var modelToLogo = {
        "Claude 4.0 Sonnet": { name: "anthropic", color: "191919" },
        "GPT-5": { src: "assets/logos/openai.svg" },
        "Gemini-3-Pro": { src: "assets/logos/google-color.svg" }
    };

    function buildPerfTable(data) {
        var wrap = document.createElement("div");
        wrap.className = "perf-table-wrap";
        var table = document.createElement("table");
        table.className = "perf-table perf-table--grouped";
        table.setAttribute("aria-label", "Performance accuracy: Standard vs MCP+");

        var thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>Model</th><th>Standard</th><th>MCP+</th></tr>";
        table.appendChild(thead);
        var tbody = document.createElement("tbody");

        domains.forEach(function (domain, domainIndex) {
            var sub = data.filter(function (d) { return d.domain === domain; });

            var headerRow = document.createElement("tr");
            var headerCell = document.createElement("td");
            headerCell.colSpan = 3;
            headerCell.className = "perf-table__domain-header";
            headerCell.textContent = domain;
            headerRow.appendChild(headerCell);
            tbody.appendChild(headerRow);

            sub.forEach(function (d) {
                var tr = document.createElement("tr");
                var logoInfo = modelToLogo[d.model] || { name: "openai", color: "666" };
                var logoUrl = logoInfo.src || ("https://cdn.simpleicons.org/" + logoInfo.name + "/" + (logoInfo.color || "666"));
                tr.innerHTML =
                    "<td class=\"perf-table__model-cell\"><span class=\"perf-table__model-inner\"><img class=\"perf-table__logo\" src=\"" + logoUrl + "\" alt=\"\" width=\"20\" height=\"20\">" + d.model + "</span></td>" +
                    "<td>" + d.perfStd + "</td><td>" + d.perfMcp + "</td>";
                tbody.appendChild(tr);
            });

            if (domainIndex < domains.length - 1) {
                var emptyRow = document.createElement("tr");
                emptyRow.className = "perf-table__spacer";
                emptyRow.innerHTML = "<td colspan=\"3\"></td>";
                tbody.appendChild(emptyRow);
            }
        });

        table.appendChild(tbody);

        var title = document.createElement("p");
        title.className = "perf-table-title";
        title.textContent = "Performance accuracy (%)";
        wrap.appendChild(title);
        wrap.appendChild(table);
        return wrap;
    }

    /* Step 10 for big numbers (Playwright, Google Search), step 1 for smaller (e.g. Yahoo Finance). Returns { max: roundedUp, step }. */
    function maxCostAndStepForDomain(domain) {
        var rows = scatterData.filter(function (d) { return d.domain === domain; });
        if (!rows.length) return { max: 0.5, step: 0.1 };
        var dataMax = 0;
        rows.forEach(function (d) { if (d.costStd > dataMax) dataMax = d.costStd; });
        var step = dataMax <= 15 ? 1 : 10;
        var max = Math.ceil(dataMax / step) * step;
        if (max < dataMax) max += step;
        return { max: max, step: step };
    }

    /* ========== X-AXIS ICON POSITIONS ==========
     * - useFixedPositions: set true to ignore auto position and use fixedLeftPx for every chart.
     * - fixedLeftPx: [left0, left1, left2] in px from overlay left (overlay has left: 68px; inner width 236).
     * - iconLeftOffsets: optional [adj0, adj1, adj2] added to auto-computed left for each icon (e.g. [0, 5, -3]).
     * - iconLeftOffsetsByDomain: optional per-chart overrides, e.g. { "Yahoo Finance": [2, 2, 2], "Google Search": [-4, -4, -4] }.
     */
    var PLAYWRIGHT_ICON_CONFIG = {
        useFixedPositions: false,
        fixedLeftPx: [30, 114, 198],
        iconLeftOffsets: null,
        iconLeftOffsetsByDomain: {
            "Playwright": [0, 0, 0],
            "Yahoo Finance": [0, -9, -17],
            "Google Search": [0, -9, -17]
          }
    };

    function getBarCenterXsInOverlayPx(svg, svgEl) {
        var rects = svg.querySelectorAll("rect");
        var centersPx = [];
        var svgLeft = svgEl && svgEl.getBoundingClientRect ? svgEl.getBoundingClientRect().left : 0;
        var overlayLeft = svgLeft + 68;
        for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            var b = r.getBBox();
            if (b.width <= 0 || b.height <= 0) continue;
            if (b.height <= b.width) continue;
            var cx = b.x + b.width / 2;
            var screenX = cx;
            if (r.getScreenCTM) {
                var pt = svg.createSVGPoint();
                pt.x = cx;
                pt.y = 0;
                pt = pt.matrixTransform(r.getScreenCTM());
                screenX = pt.x;
            }
            var overlayRelative = screenX - overlayLeft;
            var dup = false;
            for (var j = 0; j < centersPx.length; j++) {
                if (Math.abs(centersPx[j] - overlayRelative) < 15) { dup = true; break; }
            }
            if (!dup) centersPx.push(overlayRelative);
        }
        centersPx.sort(function (a, b) { return a - b; });
        return centersPx;
    }

    function addXAxisIconsOverlay(facetDiv, subset, modelToLogo) {
        var svg = facetDiv.querySelector("svg");
        if (!svg) return;
        var marginLeft = 68;
        var iconSize = 24;
        var tickInfos = [];
        var texts = svg.querySelectorAll("text");
        for (var i = 0; i < texts.length; i++) {
            var t = texts[i];
            var modelName = (t.textContent || "").trim();
            if (!modelToLogo[modelName]) continue;
            t.style.visibility = "hidden";
            tickInfos.push({ modelName: modelName, group: t.parentNode });
        }
        tickInfos.sort(function (a, b) {
            var ra = a.group.getBoundingClientRect();
            var rb = b.group.getBoundingClientRect();
            return (ra.left + ra.width / 2) - (rb.left + rb.width / 2);
        });
        var wrap = document.createElement("div");
        wrap.className = "chart-x-icons-overlay";
        var iconWraps = [];
        tickInfos.forEach(function (item) {
            var logoInfo = modelToLogo[item.modelName] || { name: "openai", color: "666" };
            var logoUrl = logoInfo.src || ("https://cdn.simpleicons.org/" + logoInfo.name + "/" + (logoInfo.color || "666"));
            var iconWrap = document.createElement("div");
            iconWrap.className = "chart-x-icon-wrap";
            iconWrap.style.left = "0px";
            var img = document.createElement("img");
            img.src = logoUrl;
            img.alt = item.modelName;
            img.title = item.modelName;
            img.className = "chart-x-icon";
            iconWrap.appendChild(img);
            wrap.appendChild(iconWrap);
            iconWraps.push(iconWrap);
        });
        var subPlot = facetDiv.children[1];
        if (!subPlot) return;
        var plotWrap = document.createElement("div");
        plotWrap.className = "chart-facet-plot-wrap";
        facetDiv.removeChild(subPlot);
        plotWrap.appendChild(subPlot);
        plotWrap.appendChild(wrap);
        facetDiv.appendChild(plotWrap);
        var cfg = PLAYWRIGHT_ICON_CONFIG;
        var domain = subset.length ? subset[0].domain : "";
        function applyPositions() {
            if (cfg.useFixedPositions && cfg.fixedLeftPx && cfg.fixedLeftPx.length >= iconWraps.length) {
                for (var j = 0; j < iconWraps.length; j++) {
                    iconWraps[j].style.left = cfg.fixedLeftPx[j] + "px";
                }
                return;
            }
            var svgEl = plotWrap.querySelector("svg");
            var barCentersPx = svgEl ? getBarCenterXsInOverlayPx(svgEl, svgEl) : [];
            if (barCentersPx.length < 3) {
                var innerWidth = 320 - marginLeft - 16;
                barCentersPx = [ innerWidth / 6, innerWidth / 2, (5 * innerWidth) / 6 ];
            }
            var offsets = (cfg.iconLeftOffsetsByDomain && domain && cfg.iconLeftOffsetsByDomain[domain]) || cfg.iconLeftOffsets;
            if (barCentersPx.length >= iconWraps.length) {
                for (var k = 0; k < iconWraps.length; k++) {
                    var leftPx = barCentersPx[k] - (iconSize / 2);
                    if (offsets && offsets[k] != null) leftPx += offsets[k];
                    iconWraps[k].style.left = leftPx + "px";
                }
            }
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(applyPositions);
        });
    }

    var barChartWrapper = document.createElement("div");
    barChartWrapper.className = "bar-chart-facets";
    barChartWrapper.setAttribute("style", "display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; justify-content: center; width: 100%;");

    domains.forEach(function (domain) {
        var subset = barData.filter(function (d) { return d.domain === domain; });
        var scale = maxCostAndStepForDomain(domain);
        var yMax = scale.max;
        var step = scale.step;
        var tickValues = [];
        for (var v = 0; v <= yMax; v += step) { tickValues.push(v); }
        if (tickValues[tickValues.length - 1] < yMax) tickValues.push(yMax);
        var plotDiv = document.createElement("div");
        plotDiv.className = "bar-chart-facet";
        plotDiv.setAttribute("style", "flex: 1 1 280px; min-width: 260px; max-width: 400px;");
        var titleEl = document.createElement("div");
        titleEl.setAttribute("style", "font-size: 0.95rem; font-weight: 600; color: #032d60; margin-bottom: 0.75rem; text-align: center;");
        titleEl.textContent = domain;
        plotDiv.appendChild(titleEl);
        var subPlot = Plot.plot({
            width: 320,
            height: 340,
            marginLeft: 68,
            marginBottom: 70,
            marginRight: 16,
            marginTop: 28,
            x: { label: null, axis: "bottom", tickRotate: -25 },
            y: { label: "Cost per Task ($)", domain: [0, yMax], ticks: tickValues, tickFormat: function (d) { return "$" + d.toFixed(2); }, grid: true },
            color: {
                domain: ["Input Cost with MCP+", "Baseline Extra Cost (Savings)"],
                range: ["#70bf75", "#a2372d"],
                legend: false
            },
            marks: [
                Plot.barY(subset, Plot.stackY({
                    x: "model",
                    y: "cost",
                    fill: "type",
                    stroke: "#333333",
                    strokeWidth: 1,
                    order: ["Input Cost with MCP+", "Baseline Extra Cost (Savings)"],
                    tip: true,
                    title: function (d) {
                        var savings = (d.costStd != null && d.costMcp != null) ? d.costStd - d.costMcp : d.cost;
                        var pct = (d.costStd != null && d.costStd > 0) ? ((savings / d.costStd) * 100).toFixed(0) : "0";
                        return d.model + "\nBaseline cost: $" + (d.costStd != null ? d.costStd.toFixed(2) : "—") +
                            "\nWith MCP+: $" + (d.costMcp != null ? d.costMcp.toFixed(2) : "—") +
                            "\nSavings: $" + savings.toFixed(2) + " (\u2193 " + pct + "%)";
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
        plotDiv.appendChild(subPlot);
        addXAxisIconsOverlay(plotDiv, subset, modelToLogo);
        barChartWrapper.appendChild(plotDiv);
    });

    barEl.appendChild(barChartWrapper);
    var perfTableWrap = buildPerfTable(scatterData);
    barEl.insertBefore(perfTableWrap, barChartWrapper);

    var costTitle = document.createElement("p");
    costTitle.className = "perf-table-title chart-title";
    costTitle.textContent = "Input Cost Comparison";
    barEl.insertBefore(costTitle, barChartWrapper);

    var legendEl = barEl.nextElementSibling;
    if (legendEl && legendEl.classList.contains("chart-legend")) {
        barEl.insertBefore(legendEl, barChartWrapper);
    }

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
            arrowRequest: 5.6,
            arrowRequestLabel: 6.0,
            arrowResponse: 4.9,
            haystack: 4.9,
            haystackLabel: 4.2,
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
            arrowInset: 1.6,
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
            arrowStrokes: { request: 1.5, requestSub: 1.5, responseRed: 2, responseGreen: 1.5 }
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
            Plot.text([{ x: R.mcpplusX, y: r.iconLabel + 0.5, label: "MCP+" }], {
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

    flowEl.appendChild(flowC);

    /* Make SVGs responsive: stretch to 100% of container width (same as surrounding text) */
    function makeSvgResponsive(el) {
        var svg = el && el.tagName === "svg" ? el : (el && el.querySelector ? el.querySelector("svg") : null);
        if (!svg) return;
        if (!svg.hasAttribute("viewBox") && svg.getAttribute("width") && svg.getAttribute("height")) {
            svg.setAttribute("viewBox", "0 0 " + svg.getAttribute("width") + " " + svg.getAttribute("height"));
        }
        svg.setAttribute("width", "100%");
        svg.removeAttribute("height");
        svg.style.height = "auto";
        svg.style.maxWidth = "100%";
    }
    barChartWrapper.querySelectorAll(".bar-chart-facet").forEach(function (facet) {
        makeSvgResponsive(facet);
    });
    makeSvgResponsive(flowC);

})();
