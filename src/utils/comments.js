const REPLY_RE = /^\[reply:(\d+)\][ \t]*\r?\n?/;

export const parseCommentContent = (content) => {
  const raw = String(content || '');
  const match = raw.match(REPLY_RE);
  if (!match) return { parentId: null, text: raw };
  return { parentId: Number(match[1]), text: raw.slice(match[0].length) };
};

export const buildCommentContent = (text, parentId) => {
  const clean = String(text || '').trim();
  return parentId ? `[reply:${parentId}]\n${clean}` : clean;
};

export const buildCommentTree = (comments, compare) => {
  const nodes = new Map();
  comments.forEach((comment) => {
    const { parentId, text } = parseCommentContent(comment.content);
    nodes.set(Number(comment.id), { comment, text, parentId, children: [] });
  });

  const roots = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortLevel = (list) => {
    list.sort((a, b) => compare(a.comment, b.comment));
    list.forEach((node) => sortLevel(node.children));
    return list;
  };

  return sortLevel(roots);
};
