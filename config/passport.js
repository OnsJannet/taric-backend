const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

// Configure JWT options with enhanced security
const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  issuer: process.env.JWT_ISSUER || 'taric-api',
  audience: process.env.JWT_AUDIENCE || 'taric-client',
  ignoreExpiration: false,
  passReqToCallback: true
};

module.exports = passport => {
  passport.use(
    new JwtStrategy(options, async (req, jwt_payload, done) => {
      try {
        // Check token expiration
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (jwt_payload.exp && jwt_payload.exp < currentTimestamp) {
          return done(null, false, { message: 'Token expired' });
        }

        // Check if token was issued before password change
        const user = await User.findById(jwt_payload.id).select('+passwordChangedAt');
        
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        // Check if user is active
        if (user.status !== 'active') {
          return done(null, false, { message: 'User account is not active' });
        }

        // Check if password was changed after token was issued
        if (user.passwordChangedAt) {
          const passwordChangedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
          
          if (passwordChangedTimestamp > jwt_payload.iat) {
            return done(null, false, { message: 'Password changed after token was issued' });
          }
        }

        // Add IP tracking for suspicious activity detection
        const userIp = req.ip || req.connection.remoteAddress;
        
        // In a real implementation, you might want to track this in the database
        console.log(`User ${user.id} authenticated from IP: ${userIp}`);

        return done(null, user);
      } catch (error) {
        console.error('Error in passport strategy:', error);
        return done(error, false);
      }
    })
  );
};
