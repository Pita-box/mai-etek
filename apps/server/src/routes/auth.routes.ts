import { Router } from 'express';
// import { register, login } from '../services/auth.service';

const router = Router();

router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint' });
});

export default router;
