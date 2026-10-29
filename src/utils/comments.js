/**
 * Nested comments ("comment comments").
 *
 * The API has no parent_id column for comments, so the relation is encoded
 * in the comment content itself with a technical prefix:
 *
 *   [reply:42]
 *   actual text of the answer
 *
 * The prefix is stored in the database, therefore every user and every
 * browser sees the same tree. It is never shown in the UI.
 */
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

/**
 * Builds a tree from the flat API list. Comments whose parent is missing
 * (deleted or hidden) become root comments. Every level is sorted with
 * `compare`.
 */
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
