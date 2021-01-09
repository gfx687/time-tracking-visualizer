import { loadDataset, mapForPie } from "./modules/dataset.js";
import { Pie } from "./modules/piechart.js";

(async function () {
  const dataset = await loadDataset();

  const pieData = mapForPie(dataset);
  Pie(pieData);
})();
