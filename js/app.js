d3.json('data.json').then(data => {
    // Filtrar enlaces duplicados
    data.links = filterDuplicateLinks(data.links);

    const width = 860;
    const height = 450;
    const body = d3.select('body');
    const svg = createSvg(body, width, height);
    const simulation = setupSimulation(data, width, height);
    const link = createLinks(svg, data);
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const node = createNodes(svg, data, color, simulation);
    const tooltip = setupTooltip(body);

    let selectedNode = null;

    function createSvg(container, width, height) {
        return container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .call(d3.zoom().on("zoom", event => {
                svg.attr("transform", event.transform);
            }))
            .append('g')
            // .attr('transform', 'translate(0,-40)');
    }

    function setupSimulation(data, width, height) {
        return d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links).id(d => d.id))
            .force('charge', d3.forceManyBody())
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on("tick", ticked);
    }

    function createLinks(svg, data) {
        return svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("stroke-width", d => Math.sqrt(d.value));
    }

    function createNodes(svg, data, color, simulation) {
        return svg.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(data.nodes)
            .enter().append("circle")
            .attr("r", d => d.type === 'parent' ? 10 : 5)
            .attr("fill", d => d.type === 'parent' ? color(d.id) : '#69b3a2')
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on("mouseover", mouseover)
            .on("mouseout", mouseout)
            .on("click", nodeClicked);
    }

    function setupTooltip(container) {
        return container.append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("max-height", "200px")   // Limita la altura del tooltip
            .style("overflow-y", "auto");   // Permite desplazamiento si el contenido excede la altura máxima
    }

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

    }

    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    function highlightNode(nodeData) {
        d3.select(nodeData).attr("r", 20).style("fill", "orange");
    }

    function highlightConnectedLinks(nodeData) {
        link.style('stroke', l => l.source === nodeData || l.target === nodeData ? 'orange' : '#aaa');
    }

    function highlightConnectedNodes(nodeData) {
        const connectedNodes = getConnectedNodes(nodeData);
        node.style("fill", n => {
            if (n === nodeData) return "orange";
            if (connectedNodes.includes(n)) return "orange";
            return n.type === 'parent' ? color(n.id) : '#69b3a2';
        });
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    function formatTooltipContent(d) {
        let content = `<div class="tooltip-title">${capitalizeFirstLetter(d.name)}</div>`;
    
        if (d.tema && d.tema.length > 0) {
            content += '<div class="tooltip-section"><span class="tooltip-subtitle">Tema:</span>';
            content += "<ul class='tooltip-list'>";
            d.tema.forEach(t => {
                content += `<li>${capitalizeFirstLetter(t)}</li>`;
            });
            content += "</ul></div>";
        }
    
        if (d.textotema && d.textotema.length > 0) {
            content += '<div class="tooltip-section"><span class="tooltip-subtitle">Texto del Tema:</span>';
            content += "<ul class='tooltip-list'>";
            d.textotema.forEach(tt => {
                content += `<li>${capitalizeFirstLetter(tt)}</li>`;
            });
            content += "</ul></div>";
        }
    
        // Relaciones (nodos hijos)
        let childLinks = data.links.filter(link => link.source.id === d.id);
        if (childLinks.length > 0) {
            content += '<div class="tooltip-section"><span class="tooltip-subtitle">Relaciones:</span>';
            content += "<ul class='tooltip-list'>";
            childLinks.forEach(link => {
                let childNode = data.nodes.find(node => node.id === link.target.id);
                if (childNode) {
                    content += `<li>${capitalizeFirstLetter(childNode.name)}</li>`;
                }
            });
            content += "</ul></div>";
        }
    
        return content;
    }         

    function mouseover(event, d) {
        if (selectedNode) return;

        highlightNode(this);
        highlightConnectedLinks(d);
        highlightConnectedNodes(d);
        
        let html = formatTooltipContent(d);
        
        tooltip.html(html)
            .transition()
            .duration(200)
            .style('opacity', .9);

        svg.call(d3.zoom().on("zoom", null));

        tooltip
            .on("mouseenter", function() {
                simulation.stop(); // Detén la simulación para evitar interferencias
            })
            .on("mouseleave", function() {
                // Reactiva el comportamiento de zoom y reinicia la simulación cuando el mouse abandone el tooltip
                svg.call(d3.zoom().on("zoom", event => {
                    svg.attr("transform", event.transform);
                }));
                simulation.restart();
            })
            .html(html)
            .transition()
            .duration(200)
            .style('opacity', .9);
    }  

    function mouseout(event, d) {
        if (selectedNode) return;
    
        node.attr("r", d => d.type === 'parent' ? 10 : 5).style("fill", d => d.type === 'parent' ? color(d.id) : '#69b3a2');
        link.style('stroke', '#aaa');
        
        tooltip.transition()
            .duration(500)
            .style('opacity', 0);

        // Reactiva el comportamiento de zoom cuando el mouse abandone el nodo
        svg.call(d3.zoom().on("zoom", event => {
            svg.attr("transform", event.transform);
        }));
    }

    function nodeClicked(event, d) {
        if (selectedNode) {
            resetStyles();
            if (selectedNode === d) {
                selectedNode = null;
                tooltip.transition().duration(500).style('opacity', 0); // Oculta el tooltip
                return;
            }
        }
    
        highlightNode(this);
        highlightConnectedLinks(d);
        highlightConnectedNodes(d);
    
        let html = formatTooltipContent(d);
    
        tooltip.html(html)
            .transition()
            .duration(200)
            .style('opacity', .9);
        
        selectedNode = d;
    }
    
    function getConnectedNodes(nodeData) {
        const connected = [];
        data.links.forEach(l => {
            if (l.source === nodeData || l.target === nodeData) {
                connected.push(l.source === nodeData ? l.target : l.source);
            }
        });
        return connected;
    }
    
    function resetStyles() {
        node.attr("r", d => d.type === 'parent' ? 10 : 5).style("fill", d => d.type === 'parent' ? color(d.id) : '#69b3a2');
        link.style('stroke', '#aaa');
    }

    function filterDuplicateLinks(links) {
        const uniqueLinks = [];
        const seen = new Set();
    
        links.forEach(link => {
            const key1 = `${link.source}-${link.target}`;
            const key2 = `${link.target}-${link.source}`;
    
            if (!seen.has(key1) && !seen.has(key2)) {
                uniqueLinks.push(link);
                seen.add(key1);
                seen.add(key2);
            }
        });
        return uniqueLinks;
    }

});
