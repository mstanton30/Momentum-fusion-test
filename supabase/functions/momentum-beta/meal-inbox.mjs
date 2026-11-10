import {callTool, HttpError} from './tools.mjs';

export async function readWorkspaceWithMealInbox(store, user) {
  const workspace = await store.getWorkspace(user);
  if (!workspace.state.entries) return workspace;

  const meals = await store.pendingMeals(user);
  const credential = {id:'momentum-beta-meal-inbox',user_id:user,label:'ChatGPT inbox'};
  for (const meal of meals) {
    let status;
    try {
      const result = await callTool(store, credential, 'log_meal', {
        ...meal.payload, request_id:meal.id
      });
      status = result.status;
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 400) throw error;
      status = 'rejected';
    }
    await store.finishInboxMeal(user, meal.id, status);
  }
  return meals.length ? store.getWorkspace(user) : workspace;
}
