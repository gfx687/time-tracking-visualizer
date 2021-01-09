export const PieTooltip = (totalHours) => {
  const tooltip = d3.create("div").attr("class", "tooltip");

  tooltip.append("div").attr("class", "label");
  tooltip.append("div").attr("class", "value");
  tooltip.append("div").attr("class", "persent");

  const onHover = (_, arc) => {
    tooltip.style("display", "block");
    tooltip.select(".label").html(arc.data.name);
    tooltip.select(".value").html(arc.value + " hours");
    tooltip
      .select(".persent")
      .html(((arc.value / totalHours) * 100).toFixed(1) + "% of total");
  };

  const onLeave = () => tooltip.style("display", "none");

  const onMove = (event) =>
    tooltip
      .style("top", event.pageY + 10 + "px")
      .style("left", event.pageX + 10 + "px");

  return [tooltip, onHover, onLeave, onMove];
};
