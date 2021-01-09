import {PieTooltip} from './piechart-tooltip.js';

const pieDiameter = 500;
const legendWidth = 300;
const svgWidth = pieDiameter + legendWidth;
const labelHeight = 20;
const visibleLayers = 1; // visible layers > 1 breaks legend
const childrenArcWidth = 10
const radius = pieDiameter / 2 / (visibleLayers + 1) - childrenArcWidth / 2; // 1 for middle circle

export const Pie = (dataset) => {
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateCool, dataset.children.length + 1));

  const root = partition(dataset);

  const svg = d3.create('svg')
    .attr('viewBox', [0, 0, svgWidth, pieDiameter])
    .style('font', '15px sans-serif');

  const hangleGroupChangeLegend = appendLegend(svg, root);
  const [tooltip, tooltipOnHover, tooltipOnLeave, tooltipOnMove] = PieTooltip(root.value);

  document.getElementById('pie').appendChild(svg.node());
  document.getElementById('pie').appendChild(tooltip.node());

  const pieSvg = svg.append('g')
    .attr('transform', `translate(${pieDiameter / 2},${pieDiameter / 2})`);

  const arc = arcBase()
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => d.y1 * radius - (radius / 57.29));

  const arcHovered = arcBase()
    .innerRadius(d => d.y0 * radius - 10)
    .outerRadius(d => d.y1 * radius + 10);

  const arcChildrenHint = arcBase()
    .innerRadius((visibleLayers + 1) * radius)
    .outerRadius((visibleLayers + 1) * radius + childrenArcWidth);

  const pie = pieSvg
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

  const pieChildrenHint = pieSvg
    .append('g')
    .selectAll('path')
    .data(root.descendants().slice(1))
    .join('path')
    .attr('fill', d => color(d.data.name))
    .attr('fill-opacity', d => isArcChildrenVisible(d.current) ? 0.6 : 0)
    .attr('d', d => arcChildrenHint(d.current));;

  pie.filter(d => d.children)
    .on('click', clicked);
  pie.filter(d => d.children && isArcVisible(d))
    .style('cursor', 'pointer');

  const middleCircle = pieSvg.append('circle')
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

    const pieTransition = pieSvg.transition().duration(0);
    pie
      .transition(pieTransition)
      .filter(arc => arc == hoveredArc)
      .attrTween('d', d => () => arcHovered(d.current));

    pieChildrenHint
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

    const pieTransition = pieSvg.transition().duration(0);
    pie
      .transition(pieTransition)
      .filter(arc => arc == hoveredArc)
      .attrTween('d', d => () => arc(d.current));

    pieChildrenHint
      .transition(pieTransition)
      .filter(arc => arc.parent?.data.name == hoveredArc.data.name)
      .attr('fill-opacity', 0.6);
  }

  function clicked(event, itemClicked) {
    if (itemClicked.depth !== 0 && !isArcVisible(itemClicked))
      return;

    middleCircle.datum(itemClicked.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - itemClicked.x0) / (itemClicked.x1 - itemClicked.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - itemClicked.x0) / (itemClicked.x1 - itemClicked.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - itemClicked.depth),
      y1: Math.max(0, d.y1 - itemClicked.depth)
    });

    const pieTransition = pieSvg.transition().duration(750);

    pie
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

    pieChildrenHint
      .transition(pieTransition)
      .tween('data', d => {
        const i = d3.interpolate(d.current, d.target);
        return t => d.current = i(t);
      })
      .filter(function (d) {
        return +this.getAttribute('fill-opacity') || isArcChildrenVisible(d.target);
      })
      .attr('fill-opacity', d => isArcChildrenVisible(d.target) ? 0.6 : 0)
      .attrTween('d', d => () => arcChildrenHint(d.current));

    hangleGroupChangeLegend(event, itemClicked);
  }
}

function appendLegend(svg, root) {
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateCool, 10));

  const legendSvg = svg
    .append('g')
    .attr('transform', `translate(${pieDiameter + legendWidth / 6},${labelHeight})`);

  const legendRects = legendSvg
    .append('g')
    .selectAll('rect')
    .data(root.descendants().slice(1))
    .join('rect')
    .attr('y', d => labelHeight * d.groupIndex * 1.8)
    .attr('width', labelHeight)
    .attr('height', labelHeight)
    .attr('fill-opacity', d => isLegendItemVisible(d) ? 1 : 0)
    .attr('fill', d => color(d.data.name));

  const legendText = legendSvg
    .append('g')
    .selectAll('text')
    .data(root.descendants().slice(1))
    .join('text')
    .text(getLegendText)
    .attr('y', d => labelHeight * 0.7 + labelHeight * d.groupIndex * 1.8)
    .attr('x', () => 5 + labelHeight * 1.2)
    .attr('opacity', d => isLegendItemVisible(d) ? 1 : 0);

  const onGroupChange = (_, clickedItem) => {
    const legendTransition = legendSvg.transition().duration(750);

    legendRects
      .transition(legendTransition)
      .attr('fill-opacity', d => isLegendItemVisible(d, clickedItem) ? 1 : 0);

    legendText
      .transition(legendTransition)
      .attr('opacity', d => isLegendItemVisible(d, clickedItem) ? 1 : 0);
  }

  return onGroupChange;

  function isLegendItemVisible(item, clickedItem) {
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
}

function partition(data) {
  const hierarchy = d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);
  const root = d3.partition()
    .size([2 * Math.PI, hierarchy.height + 1])
    (hierarchy);

  // set indexes inside of common parrent groups
  // if d.parent changed, index resets
  // works because use of d3.hierarchy creates object in a predictable way
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

  return root;
}

function arcBase() {
  return d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(0.01)
    .padRadius(radius * 2);
}

// TODO : what is `d.x1 > d.x0` for?
function isArcVisible(d) {
  const notMiddleCircle = d.y0 >= 1;
  const visible = (d.current ? d.current.y0 : d.y0) <= visibleLayers;
  return visible && notMiddleCircle && d.x1 > d.x0;
}

function isArcChildrenVisible(d) {
  const notMiddleCircle = d.y0 >= 1;
  const visible = (d.current ? d.current.y0 : d.y0) == visibleLayers + 1;
  return visible && notMiddleCircle && d.x1 > d.x0;
}
