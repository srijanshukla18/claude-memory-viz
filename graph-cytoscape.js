// Claude Memory Knowledge Graph Visualizer - Physics-Based Dancing Nodes
// Ultra-fast Canvas rendering with gravitational physics and dancing nodes

class ClaudeMemoryGraphCytoscape {
    constructor() {
        this.entities = [];
        this.relations = [];
        this.selectedNode = null;
        this.cy = null;
        this.layout = null;
        this.edgeBundling = null;
        this.physics = {
            nodeRepulsion: 8000,
            gravity: 0.5,
            edgeLength: 150,
            damping: 0.9
        };
        this.colorScale = [
            "#58a6ff", "#3fb950", "#f778ba", "#ff7b72", "#a371f7",
            "#f0b849", "#4dd0e1", "#ffc107", "#8bc34a", "#673ab7",
            "#e91e63", "#00bcd4", "#ff5722", "#9e9e9e", "#607d8b"
        ];
        this.entityTypeColors = {};
        this.nodeConnections = {};
        
        this.modal = document.getElementById('nodeModal');
        this.tooltip = document.getElementById('tooltip');
        this.reader = document.getElementById('reader');
        this.activeNodeData = null;
        
        this.setupModal();
        this.setupControls();
        this.loadData();
    }
    
    setupModal() {
        // Close modal events
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });
        
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) { // Click on backdrop
                this.closeModal();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.modal.classList.contains('visible')) {
                this.closeModal();
            } else if (event.key === 'Escape' && this.reader.classList.contains('visible')) {
                this.closeReader();
            }
        });

        document.getElementById('readMoreBtn').addEventListener('click', () => {
            if(this.activeNodeData) {
                this.openReader(this.activeNodeData);
            }
        });

        document.getElementById('readerClose').addEventListener('click', () => {
            this.closeReader();
        });
    }
    
    setupControls() {
        // Entity type filter
        document.getElementById('entityTypeFilter').addEventListener('change', () => {
            this.filterGraph();
        });
        
        // Search input
        document.getElementById('searchInput').addEventListener('input', () => {
            this.filterGraph();
        });
        
        // Physics control - controls node repulsion strength
        document.getElementById('chargeSlider').addEventListener('input', (event) => {
            const strength = Math.abs(parseInt(event.target.value));
            this.physics.nodeRepulsion = strength;
            this.updatePhysics();
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.cy.animate({
                zoom: this.cy.zoom() * 1.2,
                duration: 200
            });
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.cy.animate({
                zoom: this.cy.zoom() / 1.2,
                duration: 200
            });
        });
    }
    
    updatePhysics() {
        if (!this.layout) return;
        
        // Stop current layout
        this.layout.stop();
        
        // Start new layout with updated physics
        this.layout = this.cy.layout({
            name: 'cose-bilkent',
            idealEdgeLength: this.physics.edgeLength,
            nodeRepulsion: this.physics.nodeRepulsion,
            fit: false,
            padding: 50,
            randomize: false,
            nestingFactor: 0.1,
            gravity: this.physics.gravity,
            numIter: 2500,
            animationEasing: 'ease-out',
            animationDuration: 500
        });
        
        this.layout.run();
    }
    
    async loadData() {
        try {
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
        this.setupEdgeBundling();
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
        // Calculate node connections for sizing
        this.nodeConnections = {};
        this.entities.forEach(entity => {
            this.nodeConnections[entity.name] = 0;
        });
        
        this.relations.forEach(relation => {
            if (this.nodeConnections[relation.from] !== undefined) {
                this.nodeConnections[relation.from]++;
            }
            if (this.nodeConnections[relation.to] !== undefined) {
                this.nodeConnections[relation.to]++;
            }
        });
        
        // Assign colors to entity types
        const types = [...new Set(this.entities.map(e => e.entityType))];
        types.forEach((type, index) => {
            this.entityTypeColors[type] = this.colorScale[index % this.colorScale.length];
        });
        
        this.updateEntityTypeFilter();
        this.updateStats();
    }
    
    updateEntityTypeFilter() {
        const types = [...new Set(this.entities.map(e => e.entityType))].sort();
        
        const select = document.getElementById('entityTypeFilter');
        select.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
        
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(option);
        });
    }
    
    updateStats() {
        document.getElementById('nodeCount').textContent = `Nodes: ${this.entities.length}`;
        document.getElementById('edgeCount').textContent = `Edges: ${this.relations.length}`;
    }
    
    createVisualization() {
        // Prepare nodes for Cytoscape - size based on connections, not observations
        const nodes = this.entities.map(entity => {
            const connections = this.nodeConnections[entity.name] || 0;
            const baseSize = 25;
            const size = baseSize + (connections * 6);
            
            // Truncate name for better display
            const displayName = entity.name.length > 20 ? 
                entity.name.substring(0, 20) + '…' : entity.name;
            
            return {
                data: {
                    id: entity.name,
                    name: entity.name,
                    displayName: displayName,
                    type: entity.entityType,
                    observations: entity.observations || [],
                    connections: connections,
                    size: size,
                    color: this.entityTypeColors[entity.entityType]
                }
            };
        });
        
        // Prepare edges for Cytoscape
        const edges = this.relations.map(relation => ({
            data: {
                id: `${relation.from}-${relation.to}`,
                source: relation.from,
                target: relation.to,
                type: relation.relationType,
                label: relation.relationType.replace(/_/g, ' ')
            }
        }));
        
        // Initialize Cytoscape
        this.cy = cytoscape({
            container: document.getElementById('graph'),
            
            elements: [...nodes, ...edges],
            
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'label': 'data(displayName)',
                        'font-size': (node) => {
                            const size = node.data('size');
                            return Math.max(10, Math.min(14, size / 4)) + 'px';
                        },
                        'font-weight': '500',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'text-outline-width': 2,
                        'text-outline-color': '#0d1117',
                        'border-width': 2,
                        'border-color': 'rgba(255,255,255,0.2)',
                        'transition-property': 'border-color, background-color, box-shadow',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#58a6ff',
                        'box-shadow': '0 0 12px #58a6ff'
                    }
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'border-width': 3,
                        'border-color': '#58a6ff',
                        'opacity': 1
                    }
                },
                {
                    selector: 'node.dimmed',
                    style: {
                        'opacity': 0.15
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1.5,
                        'line-color': '#30363d',
                        'target-arrow-color': '#30363d',
                        'target-arrow-shape': 'none',
                        'curve-style': 'bezier',
                        'opacity': '0.7',
                        'label': 'data(label)',
                        'font-size': '9px',
                        'font-weight': 'normal',
                        'color': '#8b949e',
                        'text-outline-width': 2,
                        'text-outline-color': '#0d1117',
                        'text-rotation': 'autorotate',
                        'source-distance-from-node': '10px',
                        'target-distance-from-node': '10px',
                        'overlay-padding': '3px',
                        'transition-property': 'line-color, target-arrow-color, width, opacity',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'edge.highlighted',
                    style: {
                        'width': 2.5,
                        'line-color': '#58a6ff',
                        'target-arrow-color': '#58a6ff',
                        'opacity': 1,
                        'color': '#58a6ff',
                        'font-weight': 'bold',
                        'z-index': 10
                    }
                },
                {
                    selector: 'edge.dimmed',
                    style: {
                        'opacity': 0.05
                    }
                },
                {
                    selector: '.cy-edge-bundle',
                    style: {
                        'line-color': '#30363d',
                        'width': 1.5,
                        'opacity': 0.6,
                        'transition-property': 'line-color, width, opacity',
                        'transition-duration': '0.2s',
                    }
                },
                {
                    selector: '.cy-edge-bundle.highlighted',
                    style: {
                        'line-color': '#58a6ff',
                        'width': 2.5,
                        'opacity': 0.9
                    }
                },
                {
                    selector: '.cy-edge-bundle.dimmed',
                    style: {
                        'opacity': 0.1
                    }
                }
            ],
            
            layout: {
                name: 'cose-bilkent',
                idealEdgeLength: this.physics.edgeLength,
                nodeRepulsion: this.physics.nodeRepulsion,
                fit: true,
                padding: 50,
                randomize: true,
                nestingFactor: 0.1,
                gravity: this.physics.gravity,
                numIter: 2500,
                animate: 'end',
                animationDuration: 1000,
                animationEasing: 'ease-out'
            },
            
            // Enable panning and zooming
            zoomingEnabled: true,
            userZoomingEnabled: true,
            panningEnabled: true,
            userPanningEnabled: true,
            
            // Rendering options for performance
            textureOnViewport: true,
            motionBlur: true,
            motionBlurOpacity: 0.1,
            wheelSensitivity: 0.3
        });
        
        this.setupEvents();
        this.startContinuousPhysics();
    }
    
    startContinuousPhysics() {
        // Store layout reference for physics updates
        this.layout = this.cy.layout({
            name: 'cose-bilkent',
            idealEdgeLength: this.physics.edgeLength,
            nodeRepulsion: this.physics.nodeRepulsion,
            fit: false,
            padding: 50,
            randomize: false,
            nestingFactor: 0.1,
            gravity: this.physics.gravity,
            numIter: 50000,
            animationEasing: 'ease-out',
            animationDuration: 2000
        });
        
        this.layout.run();
        
        // Restart physics periodically for continuous dancing
        setInterval(() => {
            if (this.layout && !this.layout.running()) {
                this.layout.stop();
                this.layout = this.cy.layout({
                    name: 'cose-bilkent',
                    idealEdgeLength: this.physics.edgeLength,
                    nodeRepulsion: this.physics.nodeRepulsion,
                    fit: false,
                    padding: 50,
                    randomize: false,
                    nestingFactor: 0.1,
                    gravity: this.physics.gravity,
                    numIter: 500,
                    animationEasing: 'ease-out',
                    animationDuration: 1000
                });
                this.layout.run();
            }
        }, 3000);
    }
    
    setupEvents() {
        // Mouse events for tooltip
        this.cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            this.showTooltip(event.originalEvent, node.data());
        });
        
        this.cy.on('mousemove', 'node', (event) => {
            this.moveTooltip(event.originalEvent);
        });
        
        this.cy.on('mouseout', 'node', () => {
            this.hideTooltip();
        });
        
        // NEW CLICK INTERACTION: Single click = open modal directly
        this.cy.on('tap', 'node', (event) => {
            const node = event.target;
            this.openModal(node.data());
        });
        
        // Click on background to deselect
        this.cy.on('tap', (event) => {
            if (event.target === this.cy) {
                this.deselectNode();
            }
        });
        
        // Double-click background to fit
        this.cy.on('dblclick', (event) => {
            if (event.target === this.cy) {
                this.cy.animate({
                    fit: { padding: 50 }
                }, {
                    duration: 500
                });
            }
        });
    }
    
    setupEdgeBundling() {
        this.edgeBundling = this.cy.edgeBundling({
            // Run on initial layout
            bundleEdges: true, 
            // Bend strength
            bendRemovalSensitivity: 1, 
            bendStrength: 0.7, 
            // Tolerance for considering edges compatible
            compatibilityThreshold: 0.6, 
             // Don't straighten lines away from nodes
            straightenNearNodes: false,
            // Only visible edges
            isOverlappedEdge: (edge) => edge.visible() 
        });

        this.cy.on('layoutstop', () => {
             this.edgeBundling.bundle();
        });

        this.cy.on('style', 'node', (e) => {
            this.edgeBundling.update();
        });
    }
    
    showTooltip(event, nodeData) {
        const tooltip = this.tooltip;
        
        document.getElementById('tooltipTitle').textContent = nodeData.name;
        document.getElementById('tooltipType').textContent = nodeData.type.replace(/_/g, ' ').toUpperCase();
        
        const observationsList = document.getElementById('tooltipObservations');
        observationsList.innerHTML = '';
        
        const observations = nodeData.observations.slice(0, 5);
        observations.forEach(obs => {
            const li = document.createElement('li');
            li.textContent = obs;
            observationsList.appendChild(li);
        });
        
        if (nodeData.observations.length > 5) {
            const li = document.createElement('li');
            li.style.fontStyle = 'italic';
            li.style.color = '#888';
            li.textContent = `... and ${nodeData.observations.length - 5} more`;
            observationsList.appendChild(li);
        }
        
        tooltip.style.display = 'block';
        this.moveTooltip(event);
    }
    
    moveTooltip(event) {
        this.tooltip.style.left = (event.pageX + 10) + 'px';
        this.tooltip.style.top = (event.pageY - 10) + 'px';
    }
    
    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
    
    
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        
        // Unlock any previously locked nodes
        this.cy.nodes(':locked').unlock();
        
        // Clear previous selection
        this.cy.nodes().removeClass('highlighted dimmed');
        this.cy.edges().removeClass('highlighted dimmed');
        this.cy.elements('.cy-edge-bundle').removeClass('highlighted dimmed');
        
        // Get connected elements
        const selectedNode = this.cy.getElementById(nodeId);
        selectedNode.lock(); // Lock the node in place
        selectedNode.addClass('highlighted');
        
        const neighborhood = selectedNode.neighborhood();
        neighborhood.addClass('highlighted');
        
        // Also highlight the bundled edges connected to the neighborhood
        const connectedBundles = this.edgeBundling.getBundles().filter(bundle => {
            return bundle.edges.some(edge => {
                return neighborhood.edges().includes(edge) || selectedNode.connectedEdges().includes(edge);
            });
        });
        
        connectedBundles.forEach(bundle => {
            bundle.nodes.forEach(node => node.addClass('highlighted'));
            bundle.edges.forEach(edge => edge.addClass('highlighted'));
        });
        
        this.cy.elements('.cy-edge-bundle').not(connectedBundles).addClass('dimmed');
        
        // Dim non-connected elements
        this.cy.elements().not(selectedNode.union(neighborhood)).addClass('dimmed');
        
        this.updateSelectedInfo(nodeId, neighborhood.nodes().length);
    }
    
    deselectNode() {
        this.selectedNode = null;
        
        // Unlock any selected node so it rejoins the physics simulation
        this.cy.nodes(':locked').unlock();
        
        // Clear all highlighting
        this.cy.nodes().removeClass('highlighted dimmed');
        this.cy.edges().removeClass('highlighted dimmed');
        this.cy.elements('.cy-edge-bundle').removeClass('highlighted dimmed');
        
        this.updateSelectedInfo(null, 0);
    }
    
    updateSelectedInfo(nodeId, connectedCount) {
        const selectedInfo = document.getElementById('selectedInfo');
        if (nodeId) {
            selectedInfo.innerHTML = `
                <strong>Selected:</strong> ${nodeId}<br>
                <strong>Connected:</strong> ${connectedCount} nodes
            `;
        } else {
            selectedInfo.innerHTML = '';
        }
    }
    
    openModal(nodeData) {
        this.hideTooltip();
        this.activeNodeData = nodeData;
        
        // Populate modal content
        document.getElementById('modalTitle').textContent = nodeData.name;
        document.getElementById('modalType').textContent = nodeData.type.replace(/_/g, ' ').toUpperCase();
        
        // Set observation count
        document.getElementById('modalObservationCount').textContent = nodeData.observations.length;
        
        // Populate observations - now as a preview
        const observationsList = document.getElementById('modalObservations');
        observationsList.innerHTML = ''; // Clear previous content

        const previewContent = nodeData.observations.join(' ');
        
        if (nodeData.observations.length > 0) {
            const li = document.createElement('li');
            li.className = 'observation-preview';
            // Show a snippet of the content
            li.textContent = previewContent.substring(0, 200) + (previewContent.length > 200 ? '...' : '');
            observationsList.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.style.fontStyle = 'italic';
            li.style.color = '#888';
            li.textContent = 'No observations recorded';
            observationsList.appendChild(li);
        }
        
        // Find connections
        const selectedNode = this.cy.getElementById(nodeData.id);
        const connectedEdges = selectedNode.connectedEdges();
        const connections = [];
        
        connectedEdges.forEach(edge => {
            const edgeData = edge.data();
            const isOutgoing = edgeData.source === nodeData.id;
            connections.push({
                target: isOutgoing ? edgeData.target : edgeData.source,
                type: edgeData.type,
                direction: isOutgoing ? 'outgoing' : 'incoming'
            });
        });
        
        // Set connection count
        document.getElementById('modalConnectionCount').textContent = connections.length;
        
        // Populate connections
        const connectionsList = document.getElementById('modalConnections');
        connectionsList.innerHTML = '';
        
        if (connections.length > 0) {
            connections.forEach(conn => {
                const div = document.createElement('div');
                div.className = 'modal-connection';
                
                const typeSpan = document.createElement('span');
                typeSpan.className = 'modal-connection-type';
                typeSpan.textContent = conn.type.replace(/_/g, ' ');
                
                const arrow = document.createElement('span');
                arrow.className = 'arrow';
                arrow.textContent = ` ${conn.direction === 'outgoing' ? '→' : '←'} `;

                const targetSpan = document.createElement('span');
                targetSpan.className = 'modal-connection-target';
                targetSpan.textContent = conn.target;

                div.appendChild(typeSpan);
                div.appendChild(arrow);
                div.appendChild(targetSpan);
                connectionsList.appendChild(div);
            });
        } else {
            const div = document.createElement('div');
            div.className = 'modal-connection';
            div.style.fontStyle = 'italic';
            div.style.color = '#888';
            div.textContent = 'No connections found';
            connectionsList.appendChild(div);
        }
        
        // Show modal
        this.modal.classList.add('visible');
        document.getElementById('nodeModal').focus();
    }
    
    closeModal() {
        this.modal.classList.remove('visible');
        this.activeNodeData = null;
    }
    
    openReader(nodeData) {
        this.closeModal();

        document.getElementById('readerTitle').textContent = nodeData.name;
        const readerBody = document.getElementById('readerBody');
        
        // Join observations into a single markdown string and parse it
        const markdownContent = nodeData.observations.join('\n\n');
        readerBody.innerHTML = marked.parse(markdownContent);

        this.reader.classList.add('visible');
    }

    closeReader() {
        this.reader.classList.remove('visible');
    }
    
    filterGraph() {
        const typeFilter = document.getElementById('entityTypeFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        
        // Reset selection when filtering
        this.deselectNode();
        
        // Filter nodes
        this.cy.nodes().forEach(node => {
            const nodeData = node.data();
            const typeMatch = !typeFilter || nodeData.type === typeFilter;
            const searchMatch = !searchTerm || 
                nodeData.name.toLowerCase().includes(searchTerm) ||
                nodeData.observations.some(obs => obs.toLowerCase().includes(searchTerm));
            
            if (typeMatch && searchMatch) {
                node.style('display', 'element');
            } else {
                node.style('display', 'none');
            }
        });

        // Re-run layout for visible nodes
        const visibleNodes = this.cy.nodes(':visible');
        if (visibleNodes.length > 0) {
            this.cy.layout({
                name: 'cose-bilkent',
                idealEdgeLength: 150,
                nodeRepulsion: this.physics.nodeRepulsion,
                fit: true,
                padding: 50,
                randomize: false,
                nestingFactor: 0.1,
                gravity: this.physics.gravity,
                numIter: 1000,
                animate: true,
                animationDuration: 500,
                animationEasing: 'ease-out',
                eles: visibleNodes
            }).run();
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ClaudeMemoryGraphCytoscape();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.cy) { // Assumes cy instance is global or accessible
        window.cy.resize();
        window.cy.animate({
            fit: { padding: 50 }
        }, {
            duration: 500
        });
    }
});