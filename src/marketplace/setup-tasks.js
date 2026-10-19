/**
 * Pure helpers for the marketplace "next steps" task list.
 *
 * A task is a plain object:
 *
 *   {
 *     slug: String,
 *     order: Number,                 // base priority among siblings (lower first)
 *     roles: String[],               // roles allowed to see/do the task ([] = everyone)
 *     done: Boolean,                 // resolved by the host from store state/counts
 *     dependsOn: { slug: String, type: 'strict' | 'optional' }[],
 *     ...presentational fields       // title, hint, icon, action, actionLabel, dismissible
 *   }
 *
 * `strict` dependencies gate a task: while any of them is incomplete the task is
 * `locked`. `optional` dependencies only affect ordering.
 */

const STRICT = 'strict'

function baseCompare(a, b) {
  // Actionable tasks lead; locked (blocked-by-strict) tasks sink to the end so
  // the banner never opens on something the user cannot do yet.
  const aLocked = a?.locked === true ? 1 : 0
  const bLocked = b?.locked === true ? 1 : 0
  if (aLocked !== bLocked) return aLocked - bLocked

  const aOrder = Number.isFinite(a?.order) ? a.order : Number.MAX_SAFE_INTEGER
  const bOrder = Number.isFinite(b?.order) ? b.order : Number.MAX_SAFE_INTEGER
  return aOrder - bOrder
}

/**
 * Stable topological order: a task whose dependency is also in the list is
 * always placed after it. Ties fall back to `order`, then input order.
 * Dependency cycles are broken (rather than throwing) so the banner always
 * has something to render.
 */
function sortByDependencies(tasks) {
  const bySlug = new Map(tasks.map(task => [task.slug, task]))
  const sorted = [...tasks].sort(baseCompare)
  const result = []
  const visited = new Set()
  const visiting = new Set()

  function visit(task) {
    if (visited.has(task.slug) || visiting.has(task.slug)) return
    visiting.add(task.slug)
    const dependencies = (task.dependsOn || [])
      .map(dep => bySlug.get(dep.slug))
      .filter(Boolean)
      .sort(baseCompare)
    dependencies.forEach(visit)
    visiting.delete(task.slug)
    visited.add(task.slug)
    result.push(task)
  }

  sorted.forEach(visit)
  return result
}

/**
 * @param {Object[]} taskDefs every task definition the host knows about
 * @param {Object} [opts]
 * @param {String[]} [opts.roles] roles held by the current user
 * @param {String[]} [opts.dismissedSlugs] slugs dismissed for the active shop
 * @param {String[]} [opts.only] when set, only these slugs are considered
 * @returns {Object[]} ordered, unresolved tasks augmented with `locked`/`blockedBy`
 */
export function resolveSetupTasks(taskDefs = [], opts = {}) {
  const roles = Array.isArray(opts.roles) ? opts.roles : []
  const dismissedSlugs = Array.isArray(opts.dismissedSlugs) ? opts.dismissedSlugs : []
  const only = Array.isArray(opts.only) ? opts.only : null

  const doneBySlug = new Map(taskDefs.map(task => [task.slug, task.done === true]))
  const bySlug = new Map(taskDefs.map(task => [task.slug, task]))

  const visible = taskDefs
    .filter(task => !only || only.includes(task.slug))
    .filter(task => !task.done)
    .filter(task => !dismissedSlugs.includes(task.slug))
    .filter(task => {
      const taskRoles = Array.isArray(task.roles) ? task.roles : []
      return taskRoles.length === 0 || taskRoles.some(role => roles.includes(role))
    })

  const resolved = visible.map(task => {
    const blockedBy = (task.dependsOn || [])
      .filter(dep => dep.type === STRICT)
      .filter(dep => !doneBySlug.get(dep.slug))
      .map(dep => bySlug.get(dep.slug) || { slug: dep.slug })
    return { ...task, locked: blockedBy.length > 0, blockedBy }
  })

  return sortByDependencies(resolved)
}
