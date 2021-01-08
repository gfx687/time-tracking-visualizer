export const loadDataset = async () => {
  let dataset = await d3.csv('http://localhost:8000/app-data/dataset.csv');
  return dataset;
}

export const mapForPie= (dataset) => {
  let origin = {
    name: 'origin',
    value: 0,
    checked: true,
    children: []
  };

  for (const row of dataset) {
    delete row.Date;
    delete row.Mood;
    delete row.Name;
    for (const header in row) {
      let splits = row[header].split(', ');

      for (const category of splits)
        handleCategory(category, splits.length, origin);
    }
  }

  let empty = origin.children.find(x => x.name === '');
  if (empty) {
    empty.name = 'empty';
  }

  removeChildrenIfOnlyUncategorized(origin);
  // computeValues(origin, origin.value);

  return origin;
}

function removeChildrenIfOnlyUncategorized(node) {
  if (!node.children)
    return;

  if (node.children.length == 1) {
    node.value = node.children[0].value;
    node.children = [];
    return;
  }

  for (const ch of node.children) {
    removeChildrenIfOnlyUncategorized(ch);
  }
}

function computeValues(node) {
  if (!node.children)
    return node.value;

  for (const ch of node.children)
    node.value += computeValues(ch);

  return node.value;
}

function handleCategory(categoryName, splitsLen, root) {
  const category = getOrCreateNode(categoryName, root);

  let uncategorized = category.children.find(x => x.name == category.name + ".uncategorized");

  uncategorized.value += 1 / splitsLen;
}

// if node not found, creates full hierarchy from new node to root
function getOrCreateNode(name, root) {
  const found = findNode(name, root);
  if (found)
    return found;

  let parent;
  const dotPosition = name.lastIndexOf('.');
  if (dotPosition == -1) {
    parent = root;
  } else {
    const parentName = name.substring(0, dotPosition);
    parent = getOrCreateNode(parentName, root);
  }

  const node = {
    name: name,
    value: 0,
    checked: true,
    children: [{
      name: name + ".uncategorized",
      value: 0,
      checked: true,
    }]
  };
  parent.children.push(node);
  return node;
}

function findNode(nodeName, node) {
  if (node.name == nodeName)
    return node;

  if (!node.children)
    return null;

  for (const ch of node.children) {
    let result = findNode(nodeName, ch);
    if (result != null)
      return result;
  }
  return null;
}

