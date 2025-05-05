let palabras = [];

fetch('diccionario.json')
  .then(r => r.json())
  .then(data => {
    palabras = data;
    construirGrafo(data);
  });

const input = document.getElementById('inputPalabra');
input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();

  if (q === '') {
    document.getElementById('resultado').textContent = '';
    resetDestacados();
    return;
  }

  const entry = palabras.find(p => p.es.toLowerCase().startsWith(q));
  document.getElementById('resultado').textContent = entry ? entry.ng : 'No encontrada';

  if (entry) {
    destacar(entry);
  } else {
    resetDestacados();
  }
});

function destacar(entry) {
  const id_es = `${entry.id}_es`;
  const id_ng = `${entry.id}_ng`;

  d3.selectAll('circle')
    .transition().duration(200)
    .attr('stroke', d =>
      (d.id === id_es || d.id === id_ng) ? 'black' : null
    )
    .attr('stroke-width', d =>
      (d.id === id_es || d.id === id_ng) ? 3 : 0
    );

  d3.selectAll('text')
    .transition().duration(200)
    .style('font-weight', d =>
      d.id === id_es || d.id === id_ng ? 'bold' : 'normal'
    )
    .style('fill', d =>
      d.id === id_es ? 'red' :
      d.id === id_ng ? 'darkorange' : 'black'
    );

  d3.selectAll('line')
    .transition().duration(200)
    .attr('stroke', l =>
      (l.source.id === id_es && l.target.id === id_ng) ? 'red' : '#999'
    )
    .attr('stroke-width', l =>
      (l.source.id === id_es && l.target.id === id_ng) ? 3 : 1
    );
}

function resetDestacados() {
  d3.selectAll('circle')
    .transition().duration(200)
    .attr('stroke', null)
    .attr('stroke-width', 0);

  d3.selectAll('text')
    .transition().duration(200)
    .style('font-weight', 'normal')
    .style('fill', 'black');

  d3.selectAll('line')
    .transition().duration(200)
    .attr('stroke', '#999')
    .attr('stroke-width', 1);
}

function construirGrafo(data) {
  const maxPalabras = 500; // AJUSTA CUÁNTAS PALABRAS MOSTRAR
  const dataReducida = data.slice(0, maxPalabras);

  const categorias = [...new Set(dataReducida.map(d => d.categoria))];

  const coloresCategoria = {
    sustantivo: '#1f77b4',
    verbo: '#ff7f0e',
    adjetivo: '#2ca02c',
    pronombre: '#d62728',
    otro: '#9467bd'
  };

  categorias.forEach(cat => {
    if (!coloresCategoria[cat]) {
      coloresCategoria[cat] = '#' + Math.floor(Math.random()*16777215).toString(16);
    }
  });

  construirLeyenda(coloresCategoria, categorias);

  const nodes = [
    { id: 'root', label: 'palabra', tipo: 'root' },
    ...categorias.map(cat => ({
      id: `cat_${cat}`, label: cat, tipo: 'categoria', color: coloresCategoria[cat]
    })),
    ...dataReducida.flatMap(d => [
      { id: `${d.id}_es`, label: d.es, tipo: 'es', color: coloresCategoria[d.categoria] },
      { id: `${d.id}_ng`, label: d.ng, tipo: 'ng', color: coloresCategoria[d.categoria] }
    ])
  ];

  const links = [
    ...categorias.map(cat => ({
      source: 'root', target: `cat_${cat}`
    })),
    ...dataReducida.flatMap(d => [
      { source: `cat_${d.categoria}`, target: `${d.id}_es` },
      { source: `cat_${d.categoria}`, target: `${d.id}_ng` },
      { source: `${d.id}_es`, target: `${d.id}_ng`, id: d.id }
    ])
  ];

  const width = document.getElementById('grafo').clientWidth;
  const height = document.getElementById('grafo').clientHeight;

  const svg = d3.select('#grafo')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  const g = svg.append("g");
  svg.call(zoom);
  svg.call(zoom.transform, d3.zoomIdentity.scale(0.5)); // Escala inicial

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2));

  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#999');

  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 12)
    .attr('fill', d => d.tipo === 'root' ? 'gray' : d.color)
    .call(drag(simulation));

  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.label)
    .attr('x', 14)
    .attr('y', 4)
    .style('font-size', '12px');

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });

  function drag(sim) {
    return d3.drag()
      .on('start', event => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on('drag', event => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on('end', event => {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });
  }

  // Zoom automático al nodo raíz después de construir
  setTimeout(() => {
    const rootNode = nodes.find(n => n.id === 'root');
    if (rootNode) {
      const transform = d3.zoomIdentity
        .translate(width / 2 - rootNode.x * 1.5, height / 2 - rootNode.y * 1.5)
        .scale(1.5);
      svg.transition().duration(750).call(zoom.transform, transform);
    }
  }, 1000);
}

function construirLeyenda(coloresCategoria, categorias) {
  const contenedor = document.getElementById('leyenda');
  contenedor.innerHTML = '';

  categorias.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'item-leyenda';

    const cuadro = document.createElement('div');
    cuadro.className = 'cuadro-color';
    cuadro.style.backgroundColor = coloresCategoria[cat];

    const texto = document.createElement('span');
    texto.textContent = cat;

    div.appendChild(cuadro);
    div.appendChild(texto);
    contenedor.appendChild(div);
  });
}
