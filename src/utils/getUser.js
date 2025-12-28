import { auth } from '../firebase/firebaseConfig';

const user = auth.currentUser;
if (!user) return;
