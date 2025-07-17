// Claude Memory Knowledge Graph Visualizer
// Universal tool for visualizing ~/code/memory.json

class ClaudeMemoryGraph {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.entities = [];
        this.relations = [];
        this.nodes = [];
        this.links = [];
        this.selectedNode = null;
        this.highlightedNodes = new Set();
        this.highlightedLinks = new Set();
        
        this.svg = d3.select("#graph")
            .attr("width", this.width)
            .attr("height", this.height);
            
        this.g = this.svg.append("g");
        
        this.tooltip = d3.select("#tooltip");
        this.modal = d3.select("#nodeModal");
        
        this.colorScale = d3.scaleOrdinal()
            .range([
                "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57",
                "#ff9ff3", "#54a0ff", "#5f27cd", "#00d2d3", "#ff9f43",
                "#10ac84", "#ee5a24", "#0abde3", "#3742fa", "#2f3542",
                "#f1c40f", "#e74c3c", "#9b59b6", "#3498db", "#2ecc71"
            ]);
            
        this.setupZoom();
        this.setupControls();
        this.setupClickOutside();
        this.setupModal();
        this.loadData();
    }
    
    setupClickOutside() {
        // Click outside to deselect
        this.svg.on("click", (event) => {
            if (event.target === event.currentTarget) {
                this.deselectNode();
            }
        });
    }
    
    setupModal() {
        // Close modal when clicking X button
        d3.select("#modalClose").on("click", () => {
            this.closeModal();
        });
        
        // Close modal when clicking outside
        this.modal.on("click", (event) => {
            if (event.target === event.currentTarget) {
                this.closeModal();
            }
        });
        
        // Close modal with ESC key
        d3.select("body").on("keydown", (event) => {
            if (event.key === "Escape") {
                this.closeModal();
            }
        });
    }
    
    setupZoom() {
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.g.attr("transform", event.transform);
            });
            
        this.svg.call(zoom);
    }
    
    setupControls() {
        // Entity type filter
        d3.select("#entityTypeFilter").on("change", () => {
            this.filterGraph();
        });
        
        // Search input
        d3.select("#searchInput").on("input", () => {
            this.filterGraph();
        });
        
        // Physics control
        d3.select("#chargeSlider").on("input", (event) => {
            const chargeStrength = +event.target.value;
            this.simulation.force("charge").strength(chargeStrength);
            this.simulation.alpha(0.3).restart();
        });
    }
    
    async loadData() {
        try {
            // Try to load from memory.json file
            const response = await fetch('memory.json');
            if (!response.ok) throw new Error('File not found');
            
            const text = await response.text();
            this.parseMemoryData(text);
        } catch (error) {
            console.log('Loading demo data...');
            this.loadDemoData();
        }
        
        this.processData();
        this.createVisualization();
    }
    
    parseMemoryData(text) {
        const lines = text.trim().split('\n');
        
        for (const line of lines) {
            try {
                const item = JSON.parse(line);
                if (item.type === 'entity') {
                    this.entities.push(item);
                } else if (item.type === 'relation') {
                    this.relations.push(item);
                }
            } catch (e) {
                console.warn('Failed to parse line:', line);
            }
        }
    }
    
    loadDemoData() {
        // Demo data for when memory.json is not available
        this.entities = [
            {
                type: "entity",
                name: "Core Identity",
                entityType: "personality_profile",
                observations: ["Relentless drive", "Analytical mind", "Systematic approach"]
            },
            {
                type: "entity", 
                name: "Discipline System",
                entityType: "behavioral_system",
                observations: ["Daily protocols", "Phoenix recovery", "Marcus audit"]
            },
            {
                type: "entity",
                name: "Technical Skills",
                entityType: "professional_toolkit", 
                observations: ["Kubernetes expert", "SRE mastery", "DevOps automation"]
            }
        ];
        
        this.relations = [
            {
                type: "relation",
                from: "Core Identity",
                to: "Discipline System", 
                relationType: "drives"
            },
            {
                type: "relation",
                from: "Discipline System",
                to: "Technical Skills",
                relationType: "enables"
            }
        ];
    }
    
    processData() {
        // Create nodes
        this.nodes = this.entities.map(entity => ({
            id: entity.name,
            name: entity.name,
            type: entity.entityType,
            observations: entity.observations || [],
            group: entity.entityType
        }));
        
        // Create links
        this.links = this.relations.map(relation => ({
            source: relation.from,
            target: relation.to,
            type: relation.relationType
        }));
        
        // Update controls
        this.updateEntityTypeFilter();
        this.updateLegend();
        this.updateStats();
    }
    
    updateEntityTypeFilter() {
        const types = [...new Set(this.entities.map(e => e.entityType))].sort();
        
        const select = d3.select("#entityTypeFilter");
        select.selectAll("option:not(:first-child)").remove();
        
        select.selectAll("option.type-option")
            .data(types)
            .enter()
            .append("option")
            .classed("type-option", true)
            .attr("value", d => d)
            .text(d => d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    }
    
    updateLegend() {
        const types = [...new Set(this.entities.map(e => e.entityType))].sort();
        
        const legendItems = d3.select("#legendItems")
            .selectAll(".legend-item")
            .data(types);
            
        const legendEnter = legendItems.enter()
            .append("div")
            .classed("legend-item", true);
            
        legendEnter.append("div")
            .classed("legend-color", true)
            .style("background-color", d => this.colorScale(d));
            
        legendEnter.append("span")
            .text(d => d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    }
    
    updateStats() {
        d3.select("#nodeCount").text(`Nodes: ${this.nodes.length}`);
        d3.select("#edgeCount").text(`Edges: ${this.links.length}`);
    }
    
    filterGraph() {
        const typeFilter = d3.select("#entityTypeFilter").property("value");
        const searchTerm = d3.select("#searchInput").property("value").toLowerCase();
        
        // Reset selection when filtering
        this.deselectNode();
        
        // Filter nodes
        this.node.style("opacity", d => {
            const typeMatch = !typeFilter || d.type === typeFilter;
            const searchMatch = !searchTerm || 
                d.name.toLowerCase().includes(searchTerm) ||
                d.observations.some(obs => obs.toLowerCase().includes(searchTerm));
            
            return typeMatch && searchMatch ? 1 : 0.1;
        });
        
        // Filter links
        this.link.style("opacity", d => {
            const sourceVisible = this.node.filter(n => n.id === d.source.id).style("opacity") === "1";
            const targetVisible = this.node.filter(n => n.id === d.target.id).style("opacity") === "1";
            return sourceVisible && targetVisible ? 0.6 : 0.05;
        });
        
        // Also filter link labels
        this.link.select(".link-label").style("opacity", d => {
            const sourceVisible = this.node.filter(n => n.id === d.source.id).style("opacity") === "1";
            const targetVisible = this.node.filter(n => n.id === d.target.id).style("opacity") === "1";
            return sourceVisible && targetVisible ? 0.4 : 0.02;
        });
    }
    
    createVisualization() {
        // Create simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force("link", d3.forceLink(this.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .force("collision", d3.forceCollide().radius(d => Math.sqrt(d.observations.length) * 8 + 20));
            
        // Create links
        this.linkGroup = this.g.append("g").attr("class", "links");
        
        this.link = this.linkGroup
            .selectAll("g")
            .data(this.links)
            .enter().append("g")
            .attr("class", "link-group");
            
        // Link lines
        this.link.append("line")
            .attr("class", "link-line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 2);
            
        // Link labels
        this.link.append("text")
            .attr("class", "link-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "10px")
            .style("fill", "#ccc")
            .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)")
            .style("pointer-events", "none")
            .style("opacity", 0.7)
            .text(d => {
                // Clean up relation type for display
                return d.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            });
            
        // Create nodes
        this.node = this.g.append("g")
            .selectAll("g")
            .data(this.nodes)
            .enter().append("g")
            .call(d3.drag()
                .on("start", this.dragstarted.bind(this))
                .on("drag", this.dragged.bind(this))
                .on("end", this.dragended.bind(this)));
                
        // Node circles
        this.node.append("circle")
            .attr("r", d => Math.sqrt(d.observations.length) * 4 + 12)
            .attr("fill", d => this.colorScale(d.type))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
            
        // Node labels
        this.node.append("text")
            .text(d => d.name.length > 20 ? d.name.substring(0, 20) + "..." : d.name)
            .attr("x", 0)
            .attr("y", 0)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "#fff")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)")
            .style("pointer-events", "none");
            
        // Tooltip and click events
        this.node
            .on("mouseover", this.showTooltip.bind(this))
            .on("mousemove", this.moveTooltip.bind(this))
            .on("mouseout", this.hideTooltip.bind(this))
            .on("click", this.handleNodeClick.bind(this));
            
        // Simulation tick
        this.simulation.on("tick", () => {
            this.link.select(".link-line")
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
                
            this.link.select(".link-label")
                .attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2)
                .attr("transform", d => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                    return `rotate(${angle}, ${(d.source.x + d.target.x) / 2}, ${(d.source.y + d.target.y) / 2})`;
                });
                
            this.node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }
    
    showTooltip(event, d) {
        const tooltip = d3.select("#tooltip");
        
        d3.select("#tooltipTitle").text(d.name);
        d3.select("#tooltipType").text(d.type.replace(/_/g, ' ').toUpperCase());
        
        const observationsList = d3.select("#tooltipObservations");
        observationsList.selectAll("li").remove();
        
        observationsList.selectAll("li")
            .data(d.observations.slice(0, 5)) // Show first 5 observations
            .enter()
            .append("li")
            .text(obs => obs);
            
        if (d.observations.length > 5) {
            observationsList.append("li")
                .style("font-style", "italic")
                .style("color", "#888")
                .text(`... and ${d.observations.length - 5} more`);
        }
        
        tooltip.style("display", "block");
        this.moveTooltip(event);
    }
    
    moveTooltip(event) {
        const tooltip = d3.select("#tooltip");
        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
    }
    
    hideTooltip() {
        d3.select("#tooltip").style("display", "none");
    }
    
    handleNodeClick(event, d) {
        event.stopPropagation();
        
        if (this.selectedNode === d) {
            // Clicking same node again - open modal
            this.openModal(d);
        } else {
            // Select new node
            this.selectNode(d);
            // Also open modal immediately
            this.openModal(d);
        }
    }
    
    selectNode(selectedNode) {
        this.selectedNode = selectedNode;
        this.highlightedNodes.clear();
        this.highlightedLinks.clear();
        
        // Add selected node to highlighted
        this.highlightedNodes.add(selectedNode.id);
        
        // Find all connected nodes and links
        this.links.forEach(link => {
            if (link.source.id === selectedNode.id) {
                this.highlightedNodes.add(link.target.id);
                this.highlightedLinks.add(link);
            } else if (link.target.id === selectedNode.id) {
                this.highlightedNodes.add(link.source.id);
                this.highlightedLinks.add(link);
            }
        });
        
        this.updateHighlighting();
        this.updateSelectedInfo();
    }
    
    deselectNode() {
        this.selectedNode = null;
        this.highlightedNodes.clear();
        this.highlightedLinks.clear();
        this.updateHighlighting();
        this.updateSelectedInfo();
    }
    
    updateHighlighting() {
        // Update node highlighting
        this.node
            .style("opacity", d => {
                if (this.highlightedNodes.size === 0) return 1; // No selection
                return this.highlightedNodes.has(d.id) ? 1 : 0.2;
            })
            .select("circle")
            .attr("stroke-width", d => {
                if (this.selectedNode && d.id === this.selectedNode.id) return 4;
                return this.highlightedNodes.has(d.id) ? 3 : 2;
            })
            .attr("stroke", d => {
                if (this.selectedNode && d.id === this.selectedNode.id) return "#fff";
                return this.highlightedNodes.has(d.id) ? "#fff" : "#fff";
            });
            
        // Update link highlighting
        this.link
            .style("opacity", d => {
                if (this.highlightedLinks.size === 0) return 1; // No selection
                return this.highlightedLinks.has(d) ? 1 : 0.1;
            })
            .select(".link-line")
            .attr("stroke-width", d => {
                return this.highlightedLinks.has(d) ? 3 : 2;
            })
            .attr("stroke", d => {
                return this.highlightedLinks.has(d) ? "#4ecdc4" : "#999";
            });
            
        // Update link label visibility
        this.link.select(".link-label")
            .style("opacity", d => {
                if (this.highlightedLinks.size === 0) return 0.4; // Default state
                return this.highlightedLinks.has(d) ? 1 : 0.1;
            })
            .style("font-weight", d => {
                return this.highlightedLinks.has(d) ? "bold" : "normal";
            });
    }
    
    updateSelectedInfo() {
        const selectedInfo = d3.select("#selectedInfo");
        if (this.selectedNode) {
            const connectedCount = this.highlightedNodes.size - 1; // Exclude the selected node itself
            selectedInfo.html(`
                <strong>Selected:</strong> ${this.selectedNode.name}<br>
                <strong>Connected:</strong> ${connectedCount} nodes
            `);
        } else {
            selectedInfo.html("");
        }
    }
    
    openModal(nodeData) {
        // Hide tooltip if visible
        this.hideTooltip();
        
        // Populate modal content
        d3.select("#modalTitle").text(nodeData.name);
        d3.select("#modalType").text(nodeData.type.replace(/_/g, ' ').toUpperCase());
        
        // Set observation count
        d3.select("#modalObservationCount").text(nodeData.observations.length);
        
        // Populate observations
        const observationsList = d3.select("#modalObservations");
        observationsList.selectAll("li").remove();
        
        if (nodeData.observations.length > 0) {
            observationsList.selectAll("li")
                .data(nodeData.observations)
                .enter()
                .append("li")
                .text(d => d);
        } else {
            observationsList.append("li")
                .style("font-style", "italic")
                .style("color", "#888")
                .text("No observations recorded");
        }
        
        // Find connections for this node
        const connections = [];
        this.links.forEach(link => {
            if (link.source.id === nodeData.id) {
                connections.push({
                    target: link.target.name,
                    type: link.type,
                    direction: 'outgoing'
                });
            } else if (link.target.id === nodeData.id) {
                connections.push({
                    target: link.source.name,
                    type: link.type,
                    direction: 'incoming'
                });
            }
        });
        
        // Set connection count
        d3.select("#modalConnectionCount").text(connections.length);
        
        // Populate connections
        const connectionsList = d3.select("#modalConnections");
        connectionsList.selectAll(".modal-connection").remove();
        
        if (connections.length > 0) {
            connectionsList.selectAll(".modal-connection")
                .data(connections)
                .enter()
                .append("div")
                .attr("class", "modal-connection")
                .each(function(d) {
                    const element = d3.select(this);
                    element.append("span")
                        .attr("class", "modal-connection-type")
                        .text(d.type.replace(/_/g, ' '));
                    element.append("span")
                        .text(`${d.direction === 'outgoing' ? '→' : '←'} ${d.target}`);
                });
        } else {
            connectionsList.append("div")
                .attr("class", "modal-connection")
                .style("font-style", "italic")
                .style("color", "#888")
                .text("No connections found");
        }
        
        // Show modal
        this.modal.style("display", "block");
        
        // Focus on modal for keyboard navigation
        document.getElementById("nodeModal").focus();
    }
    
    closeModal() {
        this.modal.style("display", "none");
    }
    
    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ClaudeMemoryGraph();
});

// Handle window resize
window.addEventListener('resize', () => {
    location.reload(); // Simple solution for resize
});