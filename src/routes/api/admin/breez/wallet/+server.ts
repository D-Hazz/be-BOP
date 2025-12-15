import { json } from '@sveltejs/kit';
import { getBalanceAndHistory } from '$lib/server/breez';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const data = await getBalanceAndHistory();
    return json(data);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
};
