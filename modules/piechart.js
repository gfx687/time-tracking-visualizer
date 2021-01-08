const pieDiameter = 500;
const legendWidth = 300;
const svgWidth = pieDiameter + legendWidth;
const labelHeight = 20;
const visibleLayers = 1; // visible layers > 1 breaks legend
const childrenArcWidth = 10
const radius = pieDiameter / 2 / (visibleLayers + 1) - childrenArcWidth / 2; // 1 for middle circle

const PieTooltip = (totalHours) => {
  const tooltip = d3.select('#pie')
    .append('div')
    .attr('class', 'tooltip');

  tooltip.append('div').attr('class', 'label');
  tooltip.append('div').attr('class', 'value');
  tooltip.append('div').attr('class', 'persent');

  const onHover = (_, arc) => {
    tooltip.style('display', 'block');
    tooltip.select('.label').html(arc.data.name);
    tooltip.select('.value').html(arc.value + ' hours');
    tooltip.select('.persent').html((arc.value / totalHours * 100).toFixed(1) + '% of total');
  }

  const onLeave = () => tooltip.style('display', 'none');

  const onMove = (event) => {
    tooltip
      .style('top', (event.pageY + 10) + 'px')
      .style('left', (event.pageX + 10) + 'px');
  }

  return [tooltip, onHover, onLeave, onMove];
}

const partition = data => {
  const root = d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);
  return d3.partition()
    .size([2 * Math.PI, root.height + 1])
    (root);
};

// TODO : what is `d.x1 > d.x0` for?
const isArcVisible = (d) => {
  const notMiddleCircle = d.y0 >= 1;
  const visible = (d.current ? d.current.y0 : d.y0) <= visibleLayers;
  return visible && notMiddleCircle && d.x1 > d.x0;
}

const isArcChildrenVisible = (d) => {
  const notMiddleCircle = d.y0 >= 1;
  const visible = (d.current ? d.current.y0 : d.y0) == visibleLayers + 1;
  return visible && notMiddleCircle && d.x1 > d.x0;
}

const arc = d3.arc()
  .startAngle(d => d.x0)
  .endAngle(d => d.x1)
  .padAngle(0.01)
  .padRadius(radius * 2)
  .innerRadius(d => d.y0 * radius)
  .outerRadius(d => d.y1 * radius - (radius / 57.29));

const arcHovered = d3.arc()
  .startAngle(d => d.x0)
  .endAngle(d => d.x1)
  .padAngle(0.01)
  .padRadius(radius * 2)
  .innerRadius(d => d.y0 * radius - 10)
  .outerRadius(d => d.y1 * radius + 10);

const arcChildren = d3.arc()
  .startAngle(d => d.x0)
  .endAngle(d => d.x1)
  .padAngle(0.01)
  .padRadius(radius * 2)
  .innerRadius((visibleLayers + 1) * radius)
  .outerRadius((visibleLayers + 1) * radius + childrenArcWidth);

export const Pie = (dataset) => {
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateCool, dataset.children.length + 1));

  const root = partition(dataset);
  setIndexes(root);
  window.root = root;

  const [, tooltipOnHover, tooltipOnLeave, tooltipOnMove] = PieTooltip(root.value);

  const container = d3.select('#pie');
  const svg = container
    .append('svg')
    .attr('viewBox', [0, 0, svgWidth, pieDiameter])
    .style('font', '15px sans-serif');

  const pie = svg.append('g')
    .attr('transform', `translate(${pieDiameter / 2},${pieDiameter / 2})`);

  const legend = svg
    .append('g')
    .attr('transform', `translate(${pieDiameter + legendWidth / 6},${labelHeight})`);

  const path = pie
    .append('g')
    .selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
    .attr('fill', d => color(d.data.name))
    .attr('fill-opacity', d => isArcVisible(d.current) ? (d.children ? 1 : 0.6) : 0)
    .attr('d', d => arc(d.current))
    .on('mouseover', arcOnHover)
    .on('mouseout', arcOnHoverLeave)
    .on('mousemove', tooltipOnMove);

  const pathChildren = pie
    .append('g')
    .selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
    .attr('fill', d => color(d.data.name))
    .attr('fill-opacity', d => isArcChildrenVisible(d.current) ? (d.children ? 1 : 0.6) : 0)
    .attr('d', d => arcChildren(d.current));;

  path.filter(d => d.children)
    .on('click', clicked);
  path.filter(d => d.children && isArcVisible(d))
    .style('cursor', 'pointer');

  const legendRects = legend
    .append('g')
    .selectAll('rect')
    .data(root.descendants().slice(1))
    .join('rect')
    .attr('y', d => labelHeight * d.groupIndex * 1.8)
    .attr('width', labelHeight)
    .attr('height', labelHeight)
    .attr('fill-opacity', d => isLegendVisible(d) ? 1 : 0)
    .attr('fill', d => color(d.data.name));

  const legendText = legend
    .append('g')
    .selectAll('text')
    .data(root.descendants().slice(1))
    .join('text')
    .text(getLegendText)
    .attr('y', d => labelHeight * 0.7 + labelHeight * d.groupIndex * 1.8)
    .attr('x', () => 5 + labelHeight * 1.2)
    .attr('opacity', d => isLegendVisible(d) ? 1 : 0);

  const parent = pie.append('circle')
    .datum(root)
    .attr('r', radius)
    .attr('fill', 'none')
    .attr('pointer-events', 'all')
    .on('click', clicked);

  function arcOnHover(event, hoveredArc) {
    tooltipOnHover(event, hoveredArc);

    const isTransitioning = hoveredArc.target != undefined
      && hoveredArc.current.y0 !== hoveredArc.target.y0;
    if (isTransitioning || !isArcVisible(hoveredArc))
      return;

    const pieTransition = pie.transition().duration(0);
    path
      .transition(pieTransition)
      .filter(arc => arc == hoveredArc)
      .attrTween('d', d => () => arcHovered(d.current));

    pathChildren
      .transition(pieTransition)
      .filter(arc => arc.parent?.data.name == hoveredArc.data.name)
      .attr('fill-opacity', 0);
  }

  function arcOnHoverLeave(event, hoveredArc) {
    tooltipOnLeave(event, hoveredArc);

    const isTransitioning = hoveredArc.target != undefined
      && hoveredArc.current.y0 !== hoveredArc.target.y0;
    if (isTransitioning || !isArcVisible(hoveredArc))
      return;

    const pieTransition = pie.transition().duration(0);
    path
      .transition(pieTransition)
      .filter(arc => arc == hoveredArc)
      .attrTween('d', d => () => arc(d.current));

    pathChildren
      .transition(pieTransition)
      .filter(arc => arc.parent?.data.name == hoveredArc.data.name)
      .attr('fill-opacity', 0.6);
  }

  function clicked(_, p) {
    if (p.depth !== 0 && !isArcVisible(p))
      return;
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const pieTransition = pie.transition().duration(750);
    const legendTransition = legend.transition().duration(750);

    path
      .transition(pieTransition)
      .tween('data', d => {
        const i = d3.interpolate(d.current, d.target);
        return t => d.current = i(t);
      })
      .filter(function (d) {
        return +this.getAttribute('fill-opacity') || isArcVisible(d.target);
      })
      .attr('fill-opacity', d => isArcVisible(d.target) ? (d.children ? 1 : 0.6) : 0)
      .style('cursor', d => isArcVisible(d.target) && d.children ? 'pointer' : '')
      .attrTween('d', d => () => arc(d.current))

    pathChildren
      .transition(pieTransition)
      .tween('data', d => {
        const i = d3.interpolate(d.current, d.target);
        return t => d.current = i(t);
      })
      .filter(function (d) {
        return +this.getAttribute('fill-opacity') || isArcChildrenVisible(d.target);
      })
      .attr('fill-opacity', d => isArcChildrenVisible(d.target) ? (d.children ? 1 : 0.6) : 0)
      .attrTween('d', d => () => arcChildren(d.current));

    legendRects
      .transition(legendTransition)
      .attr('fill-opacity', d => isLegendVisible(d, p) ? 1 : 0);

    legendText
      .transition(legendTransition)
      .attr('opacity', d => isLegendVisible(d, p) ? 1 : 0);
  }
}

// set indexes inside of common parrent groups
// if d.parent changed, index resets
// works because use of d3.hierarchy creates object in a predictable way
function setIndexes(root) {
  let currentIndex = 0;
  let prevParentName;
  root.each(d => {
    d.current = d; // TODO : why do we need this?

    if (d.parent?.data.name != prevParentName) {
      prevParentName = d.parent?.data.name;
      currentIndex = 0;
    }

    d.groupIndex = currentIndex;
    currentIndex++;
  });
}

function isLegendVisible(item, clickedItem) {
  if (!clickedItem)
    return item.depth <= visibleLayers;
  return item.depth == clickedItem.depth + visibleLayers && clickedItem.data.name == item.parent.data.name;
}

function getLegendText(item) {
  // TODO : before simplifying name, need to add info about currently visible group
  // if (item.data.name.indexOf(item.parent?.data.name) == 0)
  //   return item.data.name.substring(item.parent?.data.name.length + 1);
  return item.data.name;
}
