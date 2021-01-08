import {loadDataset, mapForPie} from './modules/dataset.js';
import {Pie} from './modules/piechart.js';

(async function () {
  let dataset = await loadDataset();

  let pieData = mapForPie(dataset);
  Pie(pieData);
})();
