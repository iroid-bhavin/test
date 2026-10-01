// source: "body" | "query" | "params". Clean values are placed on req.validated
const JoiValidation = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }

    req.validated = { ...req.validated, ...value };

    next();
  };
};

module.exports = JoiValidation;
