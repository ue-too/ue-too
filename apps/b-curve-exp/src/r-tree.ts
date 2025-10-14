// Basic Rectangle class to represent bounding boxes
class Rectangle {
  constructor(
    public minX: number,
    public minY: number,
    public maxX: number,
    public maxY: number
  ) {}

  // Calculate area of rectangle
  area(): number {
    return (this.maxX - this.minX) * (this.maxY - this.minY);
  }

  // Check if this rectangle intersects with another
  intersects(other: Rectangle): boolean {
    return !(
      this.maxX < other.minX ||
      this.minX > other.maxX ||
      this.maxY < other.minY ||
      this.minY > other.maxY
    );
  }

  // Check if this rectangle contains another
  contains(other: Rectangle): boolean {
    return (
      this.minX <= other.minX &&
      this.minY <= other.minY &&
      this.maxX >= other.maxX &&
      this.maxY >= other.maxY
    );
  }

  // Calculate the minimum bounding rectangle that contains both rectangles
  union(other: Rectangle): Rectangle {
    return new Rectangle(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY)
    );
  }

  // Calculate area increase needed to contain another rectangle
  expansionArea(other: Rectangle): number {
    const unionRect = this.union(other);
    return unionRect.area() - this.area();
  }
}

// Entry represents either a data object (leaf) or child node (internal)
class RTreeEntry<T> {
  constructor(
    public mbr: Rectangle, // Minimum Bounding Rectangle
    public child?: RTreeNode<T>, // Child node (for internal nodes)
    public data?: T // Data object (for leaf nodes)
  ) {}

  isLeaf(): boolean {
    return this.data !== undefined;
  }
}

// RTree Node - can be either leaf or internal node
class RTreeNode<T> {
  public entries: RTreeEntry<T>[] = [];
  public isLeaf: boolean;

  constructor(isLeaf: boolean = false) {
    this.isLeaf = isLeaf;
  }

  // Add an entry to this node
  addEntry(entry: RTreeEntry<T>): void {
    this.entries.push(entry);
  }

  // Calculate the MBR that encompasses all entries in this node
  calculateMBR(): Rectangle | null {
    if (this.entries.length === 0) return null;

    let mbr = new Rectangle(
      this.entries[0].mbr.minX,
      this.entries[0].mbr.minY,
      this.entries[0].mbr.maxX,
      this.entries[0].mbr.maxY
    );

    for (let i = 1; i < this.entries.length; i++) {
      mbr = mbr.union(this.entries[i].mbr);
    }

    return mbr;
  }
}

// Main R-tree class
class RTree<T> {
  private root: RTreeNode<T>;
  private maxEntries: number;
  private minEntries: number;

  constructor(maxEntries: number = 4) {
    this.maxEntries = maxEntries;
    this.minEntries = Math.ceil(maxEntries / 2);
    this.root = new RTreeNode<T>(true); // Start with leaf node
  }

  // Insert a data object with its bounding rectangle
  insert(rectangle: Rectangle, data: T): void {
    const entry = new RTreeEntry(rectangle, undefined, data);
    const insertResult = this.insertEntry(this.root, entry);

    // Handle root split
    if (insertResult.split) {
      const newRoot = new RTreeNode<T>(false);
      newRoot.addEntry(
        new RTreeEntry(insertResult.node.calculateMBR()!, insertResult.node)
      );
      newRoot.addEntry(
        new RTreeEntry(
          insertResult.splitNode!.calculateMBR()!,
          insertResult.splitNode
        )
      );
      this.root = newRoot;
    }
  }

  // Internal method to insert an entry
  private insertEntry(
    node: RTreeNode<T>,
    entry: RTreeEntry<T>
  ): InsertResult<T> {
    if (node.isLeaf) {
      // Insert directly into leaf node
      node.addEntry(entry);

      if (node.entries.length > this.maxEntries) {
        // Split the node
        const splitNode = this.splitNode(node);
        return { node, split: true, splitNode };
      }

      return { node, split: false };
    } else {
      // Find the best child node to insert into
      const bestChild = this.chooseSubtree(node, entry.mbr);
      const insertResult = this.insertEntry(bestChild.child!, entry);

      // Update the MBR of the child entry
      bestChild.mbr = bestChild.child!.calculateMBR()!;

      // Handle child split
      if (insertResult.split) {
        const newEntry = new RTreeEntry(
          insertResult.splitNode!.calculateMBR()!,
          insertResult.splitNode
        );
        node.addEntry(newEntry);

        if (node.entries.length > this.maxEntries) {
          const splitNode = this.splitNode(node);
          return { node, split: true, splitNode };
        }
      }

      return { node, split: false };
    }
  }

  // Choose the best child node for insertion (minimize area enlargement)
  private chooseSubtree(
    node: RTreeNode<T>,
    rectangle: Rectangle
  ): RTreeEntry<T> {
    let bestEntry = node.entries[0];
    let minExpansion = bestEntry.mbr.expansionArea(rectangle);
    let minArea = bestEntry.mbr.area();

    for (let i = 1; i < node.entries.length; i++) {
      const entry = node.entries[i];
      const expansion = entry.mbr.expansionArea(rectangle);
      const area = entry.mbr.area();

      // Choose entry with least area expansion, tie-break by smallest area
      if (
        expansion < minExpansion ||
        (expansion === minExpansion && area < minArea)
      ) {
        bestEntry = entry;
        minExpansion = expansion;
        minArea = area;
      }
    }

    return bestEntry;
  }

  // Simple linear split algorithm
  private splitNode(node: RTreeNode<T>): RTreeNode<T> {
    const newNode = new RTreeNode<T>(node.isLeaf);
    const entries = node.entries;

    // Find the pair of entries with maximum separation
    let maxDistance = -1;
    let seed1 = 0,
      seed2 = 1;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const rect1 = entries[i].mbr;
        const rect2 = entries[j].mbr;
        const union = rect1.union(rect2);
        const distance = union.area() - rect1.area() - rect2.area();

        if (distance > maxDistance) {
          maxDistance = distance;
          seed1 = i;
          seed2 = j;
        }
      }
    }

    // Clear original node and add seed entries
    node.entries = [];
    node.addEntry(entries[seed1]);
    newNode.addEntry(entries[seed2]);

    // Distribute remaining entries
    for (let i = 0; i < entries.length; i++) {
      if (i === seed1 || i === seed2) continue;

      const entry = entries[i];
      const group1MBR = node.calculateMBR()!;
      const group2MBR = newNode.calculateMBR()!;

      const expansion1 = group1MBR.expansionArea(entry.mbr);
      const expansion2 = group2MBR.expansionArea(entry.mbr);

      // Add to group with less expansion needed
      if (expansion1 < expansion2) {
        node.addEntry(entry);
      } else if (expansion2 < expansion1) {
        newNode.addEntry(entry);
      } else {
        // Tie-break by smaller area
        if (group1MBR.area() <= group2MBR.area()) {
          node.addEntry(entry);
        } else {
          newNode.addEntry(entry);
        }
      }
    }

    return newNode;
  }

  // Search for all objects that intersect with the query rectangle
  search(queryRect: Rectangle): T[] {
    const results: T[] = [];
    this.searchNode(this.root, queryRect, results);
    return results;
  }

  private searchNode(
    node: RTreeNode<T>,
    queryRect: Rectangle,
    results: T[]
  ): void {
    for (const entry of node.entries) {
      if (entry.mbr.intersects(queryRect)) {
        if (node.isLeaf) {
          // Leaf node - add data to results
          results.push(entry.data!);
        } else {
          // Internal node - recursively search child
          this.searchNode(entry.child!, queryRect, results);
        }
      }
    }
  }

  // Get all objects in the tree (for debugging/testing)
  getAllObjects(): T[] {
    const results: T[] = [];
    this.getAllFromNode(this.root, results);
    return results;
  }

  private getAllFromNode(node: RTreeNode<T>, results: T[]): void {
    for (const entry of node.entries) {
      if (node.isLeaf) {
        results.push(entry.data!);
      } else {
        this.getAllFromNode(entry.child!, results);
      }
    }
  }
}

// Helper interface for insert operations
interface InsertResult<T> {
  node: RTreeNode<T>;
  split: boolean;
  splitNode?: RTreeNode<T>;
}

// Example usage and testing
interface Point {
  id: string;
  x: number;
  y: number;
}

// Create an R-tree and test it
const rtree = new RTree<Point>(4); // Max 4 entries per node

// Insert some points
const points: Point[] = [
  { id: "A", x: 1, y: 1 },
  { id: "B", x: 2, y: 3 },
  { id: "C", x: 5, y: 2 },
  { id: "D", x: 8, y: 7 },
  { id: "E", x: 3, y: 8 },
  { id: "F", x: 6, y: 4 },
  { id: "G", x: 9, y: 1 },
  { id: "H", x: 2, y: 6 },
];

// Insert points (using small rectangles around each point)
points.forEach((point) => {
  const rect = new Rectangle(
    point.x - 0.1,
    point.y - 0.1,
    point.x + 0.1,
    point.y + 0.1
  );
  rtree.insert(rect, point);
});

console.log(
  "All objects:",
  rtree.getAllObjects().map((p) => p.id)
);

// Search for points in a specific area
const queryRect = new Rectangle(0, 0, 4, 4);
const results = rtree.search(queryRect);
console.log(
  "Points in rectangle (0,0,4,4):",
  results.map((p) => `${p.id}(${p.x},${p.y})`)
);

export { RTree, Rectangle, Point };
